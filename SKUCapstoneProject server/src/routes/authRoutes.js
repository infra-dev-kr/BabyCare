const express = require("express");
const router = express.Router();
const authCtrl = require("../controllers/authController");

// 1. 이메일 인증번호 요청 (안드로이드와 일치: /auth/request-verify)
router.post("/request-verify", authCtrl.requestVerify);

// 2. 이메일 인증번호 확인 (수정됨: /verify -> /verify-code)
// 안드로이드의 @POST("/auth/verify-code")와 맞추기 위해 이름을 변경했습니다.
router.post("/verify-code", authCtrl.verifyCode);

// 3. 회원가입 (안드로이드와 일치: /auth/signup)
router.post("/signup", authCtrl.signup);

// 4. 로그인 (안드로이드와 일치: /auth/login)
router.post("/login", authCtrl.login);

// 5. 토큰 갱신 (안드로이드와 일치: /auth/refresh)
router.post("/refresh", authCtrl.refresh);

// 6. 비밀번호 재설정
router.post("/reset-password", authCtrl.resetPassword);

module.exports = router;