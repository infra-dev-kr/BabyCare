const OpenAI = require("openai");

// 1. OpenAI API를 사용하기 위한 클라이언트 객체를 만듭니다.
const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

/**
 * AI 리포트를 생성하는 핵심 로직 함수입니다.
 * @param {Object} data - 분석에 필요한 수면 및 환경 데이터
 */
async function generateAiReport(data) {
  // 2. prompt: AI에게 전달할 상세 지시문입니다. 
  // 입력받은 data(온도, 습도 등)를 문장 사이사이에 넣습니다.
  const prompt = `
### [역할 정의]
너는 신생아 수면 환경 데이터를 분석하고, 보호자가 이해하기 쉬운 리포트를 작성하는 전문가다.

### [지시 사항]
1. 제공된 [입력 데이터]를 분석하여 [출력 양식]의 {{중괄호}} 부분을 채운다.
2. 출력 양식의 구조와 문장은 유지하면서, 설명이 필요한 부분은 자연스럽게 작성한다.
3. 단순 수치 나열이 아니라 데이터를 종합적으로 해석하여 설명한다.
4. 의료적 진단처럼 단정하는 표현은 사용하지 않는다.
5. 불필요하게 불안을 유발하는 표현은 피한다.
6. 문장은 자연스럽고 이해하기 쉬운 한국어로 작성한다.

### [출력 양식]
[기본 정보]
리포트 유형은 ${data.reportType}이며, 분석 기간은 ${data.periodStart}부터 ${data.periodEnd}까지입니다.

[전체 요약]
전반적인 상태를 한 문단으로 작성한다.

[환경 상태 분석]
온도, 습도, 소음, 조도를 바탕으로 한 문단으로 작성한다.

[수면 상태 분석]
수면 점수 및 상태 분포를 바탕으로 한 문단으로 작성한다.

[이상 징후 요약]
주의할 점이나 특이사항을 한 문단으로 작성한다.

[보호자 권장 행동]
보호자가 참고할 수 있는 행동을 한 문단으로 작성한다.

[환경 데이터]
평균 온도는 ${data.environment.avgTemp}도이며, 최저 온도는 ${data.environment.minTemp}도, 최고 온도는 ${data.environment.maxTemp}도입니다.
평균 습도는 ${data.environment.avgHumidity}%이며, 최저 습도는 ${data.environment.minHumidity}%, 최고 습도는 ${data.environment.maxHumidity}%입니다.
평균 소음은 ${data.environment.avgNoise}이며, 최대 소음은 ${data.environment.maxNoise}입니다.
평균 조도는 ${data.environment.avgLight}입니다.

[수면 데이터]
평균 수면 점수는 ${data.sleep.avgSleepScore}점이며, 최고 점수는 ${data.sleep.bestSleepScore}점, 최저 점수는 ${data.sleep.worstSleepScore}점입니다.
수면 상태 분포는 쾌적 ${data.sleep.statusSummary.comfortable}회, 보통 ${data.sleep.statusSummary.normal}회, 주의 ${data.sleep.statusSummary.caution}회입니다.
평균 수면 시간은 ${data.sleep.avgSleepDuration}시간입니다.

### [입력 데이터]
${JSON.stringify(data, null, 2)}
`;

  // 3. OpenAI에 요청을 보냅니다.
  const response = await client.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [{ role: "user", content: prompt }],
    temperature: 0.7
  });

  // 4. AI가 생성한 텍스트 답변만 뽑아서 리턴합니다.
  return response.choices[0].message.content;
}

// 5. 이 파일의 기능을 외부(Controller)에서 쓸 수 있게 내보냅니다.
module.exports = { generateAiReport };