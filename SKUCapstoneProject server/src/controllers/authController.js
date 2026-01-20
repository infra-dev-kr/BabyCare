const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const EmailVerify = require("../models/EmailVerify");
const LoginHistory = require("../models/LoginHistory");
const Guardian = require("../models/Guardian");
const { sendVerifyMail } = require("../utils/mailer");
const { getClientInfo } = require("../utils/authHelper");

const JWT_SECRET = process.env.JWT_SECRET || "dev-secret";
const ACCESS_EXPIRES_IN = "15m";
const REFRESH_EXPIRES_IN = "14d";

// 1. 이메일 인증 요청
exports.requestVerify = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ ok: false, message: "email required" });
    const normalizedEmail = email.toLowerCase().trim();

    if (await User.findOne({ email: normalizedEmail })) {
      return res.status(409).json({ ok: false, message: "email exists" });
    }

    await EmailVerify.deleteMany({ email: normalizedEmail });
    const code = Math.floor(100000 + Math.random() * 900000).toString();

    await EmailVerify.create({
      email: normalizedEmail,
      code,
      expiresAt: new Date(Date.now() + 10 * 60 * 1000),
      verified: false,
    });

    await sendVerifyMail(normalizedEmail, code);
    return res.json({ ok: true });
  } catch (e) {
    console.error("request-verify error:", e);
    return res.status(500).json({ ok: false, message: e.message });
  }
};

// 2. 이메일 코드 확인
exports.verifyCode = async (req, res) => {
  try {
    const { email, code } = req.body;
    if (!email || !code) return res.status(400).json({ ok: false, message: "missing fields" });
    const normalizedEmail = email.toLowerCase().trim();

    const record = await EmailVerify.findOne({
      email: normalizedEmail,
      code,
      expiresAt: { $gt: new Date() },
    });

    if (!record) return res.status(400).json({ ok: false, message: "invalid or expired code" });

    await EmailVerify.updateOne({ _id: record._id }, { $set: { verified: true } });
    return res.json({ ok: true });
  } catch (e) {
    console.error("verify error:", e);
    return res.status(500).json({ ok: false, message: e.message });
  }
};


// 3. 회원가입
exports.signup = async (req, res) => {
  try {
    const { email, username, password, consent, babyBirth } = req.body;

    // ✅ A: babyBirth까지 필수로 강제
    if (!email || !username || !password || consent !== true || !babyBirth) {
      return res.status(400).json({ ok: false, message: "missing fields" });
    }

    const normalizedEmail = email.toLowerCase().trim();
    const normalizedUsername = username.toLowerCase().trim();

    // ✅ babyBirth 형식 검증 & Date 변환
    // Android에서는 "YYYY-MM-DD" 또는 ISO 문자열 추천
    const babyBirthDate = new Date(babyBirth);
    if (isNaN(babyBirthDate.getTime())) {
      return res.status(400).json({ ok: false, message: "invalid babyBirth format" });
    }

    const verified = await EmailVerify.findOne({ email: normalizedEmail, verified: true });
    if (!verified) return res.status(403).json({ ok: false, message: "email not verified" });

    if (await User.findOne({ email: normalizedEmail })) {
      return res.status(409).json({ ok: false, message: "email exists" });
    }
    if (await User.findOne({ username: normalizedUsername })) {
      return res.status(409).json({ ok: false, message: "username exists" });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const user = await User.create({
      email: normalizedEmail,
      username: normalizedUsername,
      passwordHash,
      verified: true,
      consentAt: new Date(),

      // ✅ 추가 저장
      babyBirth: babyBirthDate,
    });

    await Guardian.create({ ownerId: user._id, memberId: user._id, role: "OWNER" });
    await EmailVerify.deleteMany({ email: normalizedEmail });

    return res.status(201).json({ ok: true, userId: user._id });
  } catch (e) {
    console.error("signup error:", e);
    return res.status(500).json({ ok: false, message: e.message });
  }
};


// 4. 로그인
exports.login = async (req, res) => {
  const { ip, userAgent } = getClientInfo(req);
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      await LoginHistory.create({ userId: null, usernameTried: "", ip, userAgent, success: false, reason: "MISSING_FIELDS" }).catch(() => {});
      return res.status(400).json({ ok: false, message: "missing fields" });
    }

    const normalizedUsername = username.toLowerCase().trim();
    const user = await User.findOne({ username: normalizedUsername });

    if (!user) {
      await LoginHistory.create({ userId: null, usernameTried: normalizedUsername, ip, userAgent, success: false, reason: "NO_USER" }).catch(() => {});
      return res.status(401).json({ ok: false, message: "invalid credentials" });
    }

    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) {
      await LoginHistory.create({ userId: user._id, usernameTried: user.username, ip, userAgent, success: false, reason: "BAD_PASSWORD" }).catch(() => {});
      return res.status(401).json({ ok: false, message: "invalid credentials" });
    }

    const accessToken = jwt.sign({ userId: user._id }, JWT_SECRET, { expiresIn: ACCESS_EXPIRES_IN });
    const refreshToken = jwt.sign({ userId: user._id }, JWT_SECRET, { expiresIn: REFRESH_EXPIRES_IN });

    await LoginHistory.create({ userId: user._id, usernameTried: user.username, ip, userAgent, success: true, reason: "OK" }).catch(() => {});
    return res.json({ ok: true, accessToken, refreshToken });
  } catch (e) {
    console.error("login error:", e);
    return res.status(500).json({ ok: false, message: "server error" });
  }
};

// 5. 토큰 갱신
exports.refresh = (req, res) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) return res.status(400).json({ ok: false, message: "missing refreshToken" });

    const decoded = jwt.verify(refreshToken, JWT_SECRET);
    const accessToken = jwt.sign({ userId: decoded.userId }, JWT_SECRET, { expiresIn: ACCESS_EXPIRES_IN });

    return res.json({ ok: true, accessToken });
  } catch {
    return res.status(401).json({ ok: false, message: "invalid refreshToken" });
  }
};
// 6. 비밀번호 재설정
exports.resetPassword = async (req, res) => {
  try {
    const { email, newPassword } = req.body;
    if (!email || !newPassword) {
      return res.status(400).json({ ok: false, message: "missing fields" });
    }

    const normalizedEmail = email.toLowerCase().trim();

    // 이메일 인증이 완료된 상태인지 확인
    const verified = await EmailVerify.findOne({
      email: normalizedEmail,
      verified: true,
    });

    if (!verified) {
      return res.status(403).json({ ok: false, message: "email not verified" });
    }

    const user = await User.findOne({ email: normalizedEmail });
    if (!user) {
      return res.status(404).json({ ok: false, message: "user not found" });
    }

    // 새 비밀번호 암호화
    const passwordHash = await bcrypt.hash(newPassword, 10);
    user.passwordHash = passwordHash;
    await user.save();

    // 인증 기록 삭제 (같은 인증번호 재사용 방지)
    await EmailVerify.deleteMany({ email: normalizedEmail });

    return res.json({ ok: true, message: "password updated" });
  } catch (e) {
    console.error("reset-password error:", e);
    return res.status(500).json({ ok: false, message: e.message });
  }
};
