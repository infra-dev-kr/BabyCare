const OpenAI = require("openai");

const AiReport = require("../models/ai");
const Sleep = require("../models/Sleep");

const client = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
});

/**
 * GPT 리포트 생성
 */
const generateAiReport = async (data) => {

    const prompt = `
### [역할 정의]
너는 신생아 수면 환경 데이터를 분석하고,
보호자가 이해하기 쉬운 리포트를 작성하는 전문가다.

### [지시 사항]
1. 제공된 데이터를 분석하여 리포트를 작성한다.
2. 부모가 쉽게 이해할 수 있도록 자연스럽고 다정하게 설명한다.
3. 의료 진단이 아닌 환경 개선 중심으로 설명한다.
4. 한국어로 작성한다.

### [출력 양식]

[기본 정보]
리포트 유형: ${data.reportType}
분석 기간: ${data.periodStart} ~ ${data.periodEnd}

[전체 요약]

[환경 상태 분석]

[수면 상태 분석]

[이상 징후 및 권장 행동]

### [입력 데이터]
${JSON.stringify(data, null, 2)}
`;

    const response =
            await client.chat.completions.create({

                model: "gpt-4o-mini",

                messages: [
                    {
                        role: "user",
                        content: prompt
                    }
                ],

                temperature: 0.7
            });

    return response.choices[0].message.content;
};

/**
 * 사용자별 AI 리포트 생성
 */
exports.generateDailyReport = async (userId) => {

    try {

        if (!userId) {

            console.log("userId 없음");
            return null;
        }

        const now = new Date();

        const last12h =
                new Date(Date.now() - 12 * 60 * 60 * 1000);

        const today =
                now.toISOString().slice(0, 10);

        /**
         * 중복 생성 방지
         */
        const existing =
                await AiReport.findOne({

                    userId: userId,

                    reportType:
                            "아침 수면 종합 리포트",

                    createdAt: {
                        $gte: new Date(today)
                    }
                });

        if (existing) {

            console.log(
                    `[AI 리포트] 이미 존재함 userId=${userId}`
            );

            return existing;
        }

        /**
         * 최근 12시간 수면 데이터 조회
         */
        const nightData =
                await Sleep.find({

                    userId: userId,

                    createdAt: {
                        $gte: last12h
                    }
                });

        if (nightData.length === 0) {

            console.log(
                    `[AI 리포트] 데이터 없음 userId=${userId}`
            );

            return null;
        }

        /**
         * 평균 계산
         */
        const avgTemp = parseFloat(
                (
                        nightData.reduce(
                                (a, b) => a + b.temp,
                                0
                        ) / nightData.length
                ).toFixed(1)
        );

        const avgHumidity = parseFloat(
                (
                        nightData.reduce(
                                (a, b) => a + b.humidity,
                                0
                        ) / nightData.length
                ).toFixed(1)
        );

        const avgNoise = parseFloat(
                (
                        nightData.reduce(
                                (a, b) => a + b.noise,
                                0
                        ) / nightData.length
                ).toFixed(1)
        );

        const avgScore = parseFloat(
                (
                        nightData.reduce(
                                (a, b) =>
                                        a + (b.actualScore || 0),
                                0
                        ) / nightData.length
                ).toFixed(1)
        );

        const cryingCount =
                nightData.filter(
                        d => d.isCrying === 1
                ).length;

        const periodStart =
                last12h
                        .toISOString()
                        .slice(0, 16)
                        .replace("T", " ");

        const periodEnd =
                now
                        .toISOString()
                        .slice(0, 16)
                        .replace("T", " ");

        /**
         * GPT 전달 데이터
         */
        const data = {

            userId: userId,

            reportType:
                    "아침 수면 종합 리포트",

            periodStart,

            periodEnd,

            avgTemp,

            avgHumidity,

            avgNoise,

            avgScore,

            cryingCount,

            dataCount: nightData.length
        };

        /**
         * GPT 리포트 생성
         */
        const reportText =
                await generateAiReport(data);

        /**
         * MongoDB 저장
         */
        const report =
                new AiReport({

                    userId: userId,

                    reportType:
                            data.reportType,

                    periodStart:
                            data.periodStart,

                    periodEnd:
                            data.periodEnd,

                    avgTemp:
                            data.avgTemp,

                    avgHumidity:
                            data.avgHumidity,

                    avgNoise:
                            data.avgNoise,

                    avgScore:
                            data.avgScore,

                    cryingCount:
                            data.cryingCount,

                    dataCount:
                            data.dataCount,

                    reportText:
                            reportText,

                    createdAt:
                            new Date()
                });

        await report.save();

        console.log(
                `🌅 AI 리포트 생성 완료 userId=${userId}`
        );

        return report;

    } catch (err) {

        console.error(
                "generateDailyReport 에러:",
                err
        );

        return null;
    }
};

/**
 * 최신 리포트 조회
 */
exports.getLatestReport = async (req, res) => {

    try {

        const { userId } = req.query;

        if (!userId) {

            return res.status(400).json({

                success: false,

                message: "userId 필요"
            });
        }

        const report =
                await AiReport.findOne({

                    userId: userId
                }).sort({
                    createdAt: -1
                });

        if (!report) {

            return res.status(404).json({

                success: false,

                message:
                        "생성된 리포트가 없습니다."
            });
        }

        res.status(200).json({

            success: true,

            data: report
        });

    } catch (err) {

        console.error(
                "getLatestReport 에러:",
                err
        );

        res.status(500).json({

            success: false,

            message: err.message
        });
    }
};

/**
 * 안드로이드 수동 리포트 생성
 */
exports.createReport = async (req, res) => {

    try {

        const { userId } = req.body;

        if (!userId) {

            return res.status(400).json({

                success: false,

                message: "userId 필요"
            });
        }

        const report =
                await exports.generateDailyReport(
                        userId
                );

        if (!report) {

            return res.status(404).json({

                success: false,

                message:
                        "리포트 생성 데이터 없음"
            });
        }

        res.status(200).json({

            success: true,

            data: report
        });

    } catch (err) {

        console.error(
                "createReport 에러:",
                err
        );

        res.status(500).json({

            success: false,

            message: err.message
        });
    }
};