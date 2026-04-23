const express = require("express");
const router = express.Router();
// 1. 해당 기능을 담당하는 컨트롤러를 불러옵니다.
const aiController = require("../controllers/aiController");

// 2. POST 방식으로 "/generate" 주소에 요청이 오면 컨트롤러의 createReport 함수를 실행합니다.
router.post("/generate", aiController.createReport);

// 3. 이 라우터 설정을 내보냅니다.
module.exports = router;