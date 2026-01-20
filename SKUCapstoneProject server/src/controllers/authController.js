

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

/* =====================================================
   1. 회원가입용 이메일 인증 요청
===================================================== */
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

/* =====================================================
   1-2. 비밀번호 재설정용 이메일 인증 요청
===================================================== */
exports.requestResetVerify = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ ok: false, message: "email required" });

    const normalizedEmail = email.toLowerCase().trim();

    const user = await User.findOne({ email: normalizedEmail });
    if (!user) {
      return res.status(404).json({ ok: false, message: "email not found" });
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
    console.error("request-reset-verify error:", e);
    return res.status(500).json({ ok: false, message: e.message });
  }
};

/* =====================================================
   2. 이메일 인증번호 확인
===================================================== */
exports.verifyCode = async (req, res) => {
  try {
    const { email, code } = req.body;
    if (!email || !code) {
      return res.status(400).json({ ok: false, message: "missing fields" });
    }

    const normalizedEmail = email.toLowerCase().trim();

    const record = await EmailVerify.findOne({
      email: normalizedEmail,
      code,
      expiresAt: { $gt: new Date() },
    });

    if (!record) {
      return res.status(400).json({ ok: false, message: "invalid or expired code" });
    }

    await EmailVerify.updateOne({ _id: record._id }, { $set: { verified: true } });
    return res.json({ ok: true });
  } catch (e) {
    console.error("verify error:", e);
    return res.status(500).json({ ok: false, message: e.message });
  }
};

/* =====================================================
   3. 회원가입
===================================================== */
exports.signup = async (req, res) => {
  try {
    const { email, username, password, consent, babyBirth } = req.body;

    if (!email || !username || !password || consent !== true || !babyBirth) {
      return res.status(400).json({ ok: false, message: "missing fields" });
    }

    const normalizedEmail = email.toLowerCase().trim();
    const normalizedUsername = username.toLowerCase().trim();

    const birthDate = new Date(babyBirth);
    if (isNaN(birthDate.getTime())) {
      return res.status(400).json({ ok: false, message: "invalid babyBirth format" });
    }

    const verified = await EmailVerify.findOne({
      email: normalizedEmail,
      verified: true,
    });
    if (!verified) {
      return res.status(403).json({ ok: false, message: "email not verified" });
    }

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
      babyBirth: birthDate,
    });

    await Guardian.create({
      ownerId: user._id,
      memberId: user._id,
      role: "OWNER",
    });

    await EmailVerify.deleteMany({ email: normalizedEmail });

    return res.status(201).json({ ok: true, userId: user._id });
  } catch (e) {
    console.error("signup error:", e);
    return res.status(500).json({ ok: false, message: e.message });
  }
};

/* =====================================================
   4. 로그인
===================================================== */
exports.login = async (req, res) => {
  const { ip, userAgent } = getClientInfo(req);

  try {
    const { username, password } = req.body;
    if (!username || !password) {
      await LoginHistory.create({
        userId: null,
        usernameTried: "",
        ip,
        userAgent,
        success: false,
        reason: "MISSING_FIELDS",
      }).catch(() => {});
      return res.status(400).json({ ok: false, message: "missing fields" });
    }

    const normalizedUsername = username.toLowerCase().trim();
    const user = await User.findOne({ username: normalizedUsername });

    if (!user) {
      await LoginHistory.create({
        userId: null,
        usernameTried: normalizedUsername,
        ip,
        userAgent,
        success: false,
        reason: "NO_USER",
      }).catch(() => {});
      return res.status(401).json({ ok: false, message: "invalid credentials" });
    }

    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) {
      await LoginHistory.create({
        userId: user._id,
        usernameTried: user.username,
        ip,
        userAgent,
        success: false,
        reason: "BAD_PASSWORD",
      }).catch(() => {});
      return res.status(401).json({ ok: false, message: "invalid credentials" });
    }

    const accessToken = jwt.sign({ userId: user._id }, JWT_SECRET, {
      expiresIn: ACCESS_EXPIRES_IN,
    });
    const refreshToken = jwt.sign({ userId: user._id }, JWT_SECRET, {
      expiresIn: REFRESH_EXPIRES_IN,
    });

    await LoginHistory.create({
      userId: user._id,
      usernameTried: user.username,
      ip,
      userAgent,
      success: true,
      reason: "OK",
    }).catch(() => {});

    return res.json({ ok: true, accessToken, refreshToken });
  } catch (e) {
    console.error("login error:", e);
    return res.status(500).json({ ok: false, message: "server error" });
  }
};

/* =====================================================
   5. 토큰 갱신
===================================================== */
exports.refresh = (req, res) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) {
      return res.status(400).json({ ok: false, message: "missing refreshToken" });
    }

    const decoded = jwt.verify(refreshToken, JWT_SECRET);
    const accessToken = jwt.sign(
      { userId: decoded.userId },
      JWT_SECRET,
      { expiresIn: ACCESS_EXPIRES_IN }
    );

    return res.json({ ok: true, accessToken });
  } catch (e) {
    return res.status(401).json({ ok: false, message: "invalid refreshToken" });
  }
};

/* =====================================================
   6. 비밀번호 재설정
===================================================== */
exports.resetPassword = async (req, res) => {
  try {
    const { email, newPassword } = req.body;
    if (!email || !newPassword) {
      return res.status(400).json({ ok: false, message: "missing fields" });
    }

    const normalizedEmail = email.toLowerCase().trim();

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

    const passwordHash = await bcrypt.hash(newPassword, 10);
    user.passwordHash = passwordHash;
    await user.save();

    await EmailVerify.deleteMany({ email: normalizedEmail });

    return res.json({ ok: true, message: "password updated" });
  } catch (e) {
    console.error("reset-password error:", e);
    return res.status(500).json({ ok: false, message: e.message });
  }
};


// controllers/authController.js

exports.updateProfile = async (req, res) => {
    // 안드로이드에서 보낼 데이터: email(조회용), username, babyBirth
    const { email, username, babyBirth } = req.body; 

    try {
        // 1. 유저를 찾아서 정보 업데이트
        const updatedUser = await User.findOneAndUpdate(
            { email: email }, // 이메일로 해당 유저를 찾음
            { 
                $set: { 
                    username: username, 
                    babyBirth: babyBirth 
                } 
            },
            { new: true } // 업데이트된 후의 데이터를 반환받음
        );

        if (!updatedUser) {
            return res.status(404).json({ ok: false, message: "사용자를 찾을 수 없습니다." });
        }

        res.status(200).json({ 
            ok: true, 
            message: "개인정보가 성공적으로 수정되었습니다.",
            user: {
                username: updatedUser.username,
                babyBirth: updatedUser.babyBirth
            }
        });
    } catch (error) {
        console.error("Update Error:", error);
        res.status(500).json({ ok: false, message: "서버 오류 발생" });
    }
};