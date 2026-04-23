// 1. 위에서 만든 Model 파일을 불러옵니다.
const aiModel = require("../models/ai");

/**
 * 사용자가 리포트 생성을 요청했을 때 실행되는 컨트롤러 함수입니다.
 */
exports.createReport = async (req, res) => {
  try {
    // 2. 사용자가 보낸 데이터(Body)를 가져옵니다.
    const data = req.body;

    // 3. Model에 있는 generateAiReport 함수를 실행시켜 리포트를 만듭니다.
    const reportContent = await aiModel.generateAiReport(data);

    // 4. 성공적으로 만들어지면 사용자에게 리포트 내용을 보내줍니다.
    res.status(200).json({
      success: true,
      data: reportContent
    });
  } catch (error) {
    // 5. 만약 에러가 발생하면 에러 메시지를 보내줍니다.
    console.error("AI 리포트 생성 중 에러 발생:", error);
    res.status(500).json({
      success: false,
      message: "AI 리포트를 생성하는 중에 문제가 발생했습니다."
    });
  }
};