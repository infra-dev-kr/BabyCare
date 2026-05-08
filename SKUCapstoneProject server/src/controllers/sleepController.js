const { MLR } = require('ml-regression');

const Sleep = require('../models/Sleep');
const TemperHumility = require('../models/TemperHumility');

const aiController = require('./aiController');

let sleepModel = null;

/**
 * 수면 점수 계산
 */
const calcScore = (temp, humidity, noise, isCrying) => {

    let score = 100;

    score -= 6 * Math.abs(temp - 23);
    score -= 0.5 * Math.abs(humidity - 50);
    score -= 1 * Math.abs(noise - 40);
    score -= 45 * (isCrying ? 1 : 0);

    return Math.max(0, Math.min(100, Math.round(score)));
};

/**
 * ML 학습용 데이터 생성
 */
exports.seedMLData = async (req, res) => {

    try {

        const dummyData = [];

        for (let i = 0; i < 300; i++) {

            const temp = 20 + Math.random() * 8;
            const humidity = 40 + Math.random() * 25;
            const noise = 30 + Math.random() * 35;
            const isCrying = Math.random() > 0.7 ? 1 : 0;

            const score = calcScore(
                    temp,
                    humidity,
                    noise,
                    isCrying
            );

            dummyData.push({
                userId: "lkms1472",
                temp: Number(temp.toFixed(1)),
                humidity: Number(humidity.toFixed(1)),
                noise: Number(noise.toFixed(1)),
                isCrying,
                actualScore: score,
                createdAt: new Date()
            });
        }

        await Sleep.insertMany(dummyData);

        res.json({
            success: true,
            inserted: dummyData.length
        });

    } catch (err) {

        res.status(500).json({
            error: err.message
        });
    }
};

/**
 * ML 모델 학습
 */
const trainSleepModel = async () => {

    try {

        const data = await Sleep.find();

        if (data.length < 10) {
            console.log("학습 데이터 부족");
            return;
        }

        const inputs = data.map(d => [
            d.temp,
            d.humidity,
            d.noise,
            d.isCrying
        ]);

        const outputs = data.map(d => [
            d.actualScore
        ]);

        sleepModel = new MLR(inputs, outputs);

        console.log("ML 모델 학습 완료");

    } catch (err) {

        console.error("ML 학습 에러:", err);
    }
};

/**
 * 수면 분석 결과 조회
 */
exports.getSleepAnalysis = async (req, res) => {

    try {

        const { userId } = req.query;

        if (!userId) {
            return res.status(400).json({
                message: "userId가 필요합니다."
            });
        }

        const latest = await Sleep.findOne({
            userId: userId
        }).sort({
            createdAt: -1
        });

        if (!latest) {
            return res.status(404).json({
                message: "수면 데이터 없음"
            });
        }

        if (!sleepModel) {
            await trainSleepModel();
        }

        let predictedScore = null;

        if (sleepModel) {

            predictedScore = sleepModel.predict([
                latest.temp,
                latest.humidity,
                latest.noise,
                latest.isCrying
            ]);
        }

        res.json({
            success: true,
            data: {
                userId: latest.userId,
                temp: latest.temp,
                humidity: latest.humidity,
                noise: latest.noise,
                isCrying: latest.isCrying,
                actualScore: latest.actualScore,
                predictedScore: predictedScore
                    ? Math.round(predictedScore[0])
                    : null,
                createdAt: latest.createdAt
            }
        });

    } catch (err) {

        res.status(500).json({
            error: err.message
        });
    }
};

/**
 * 사용자별 시간 단위 배치 처리
 */
exports.processHourlyBatch = async (userId) => {

    try {

        const oneHourAgo =
                new Date(Date.now() - 60 * 60 * 1000);

        const stats = await Sleep.aggregate([
            {
                $match: {
                    userId: userId,
                    createdAt: {
                        $gte: oneHourAgo
                    }
                }
            },
            {
                $group: {
                    _id: null,
                    avgT: { $avg: "$temp" },
                    avgH: { $avg: "$humidity" },
                    avgN: { $avg: "$noise" },
                    cryingCount: {
                        $sum: "$isCrying"
                    }
                }
            }
        ]);

        if (stats.length === 0) {

            console.log("집계 데이터 없음");
            return;
        }

        const {
            avgT,
            avgH,
            avgN,
            cryingCount
        } = stats[0];

        const hourlyScore = calcScore(
                avgT,
                avgH,
                avgN,
                cryingCount > 0
        );

        const summaryRecord = new Sleep({
            userId: userId,
            temp: Number(avgT.toFixed(1)),
            humidity: Number(avgH.toFixed(1)),
            noise: Number(avgN.toFixed(1)),
            isCrying: cryingCount > 0 ? 1 : 0,
            actualScore: hourlyScore,
            createdAt: new Date()
        });

        await summaryRecord.save();

        await TemperHumility.findOneAndUpdate(
                {
                    userId: userId
                },
                {
                    $set: {
                        sleepScore: hourlyScore
                    }
                },
                {
                    sort: {
                        timestamp: -1
                    }
                }
        );

        console.log(
                `[Batch 완료] userId=${userId}, score=${hourlyScore}`
        );

    } catch (err) {

        console.error("Batch 에러:", err);
    }
};

/**
 * 사용자별 수면 점수 업데이트
 */
exports.updateSleepScoreForUser = async (userId) => {

    try {

        const tenMinAgo =
                new Date(Date.now() - 10 * 60 * 1000);

        const stats = await Sleep.aggregate([
            {
                $match: {
                    userId: userId,
                    createdAt: {
                        $gte: tenMinAgo
                    }
                }
            },
            {
                $group: {
                    _id: null,
                    avgT: { $avg: "$temp" },
                    avgH: { $avg: "$humidity" },
                    avgN: { $avg: "$noise" },
                    cryingCount: {
                        $sum: "$isCrying"
                    }
                }
            }
        ]);

        if (stats.length === 0) {

            console.log("점수 계산 데이터 없음");
            return;
        }

        const {
            avgT,
            avgH,
            avgN,
            cryingCount
        } = stats[0];

        const score = calcScore(
                avgT,
                avgH,
                avgN,
                cryingCount > 0
        );

        await TemperHumility.findOneAndUpdate(
                {
                    userId: userId
                },
                {
                    $set: {
                        sleepScore: score
                    }
                },
                {
                    sort: {
                        timestamp: -1
                    }
                }
        );

        console.log(
                `[SleepScore 저장] userId=${userId}, score=${score}`
        );

        return score;

    } catch (err) {

        console.error(
                "updateSleepScoreForUser 에러:",
                err
        );
    }
};

/**
 * GPT 종합 리포트 생성
 */
exports.generateDailyComprehensiveReport = async () => {

    try {

        console.log("GPT 리포트 생성 시작");

        await aiController.generateDailyReport();

        console.log("GPT 리포트 생성 완료");

    } catch (err) {

        console.error(
                "GPT 리포트 생성 에러:",
                err
        );
    }
};

/**
 * 분석 결과 저장
 */
exports.recordAnalysisResult = async (req, res) => {

    try {

        const {
            userId,
            temp,
            humidity,
            noise,
            isCrying
        } = req.body;

        if (!userId) {

            return res.status(400).json({
                message: "userId 필요"
            });
        }

        const score = calcScore(
                temp,
                humidity,
                noise,
                isCrying
        );

        const record = new Sleep({
            userId: userId,
            temp: temp,
            humidity: humidity,
            noise: noise,
            isCrying: isCrying ? 1 : 0,
            actualScore: score,
            createdAt: new Date()
        });

        await record.save();

        await TemperHumility.findOneAndUpdate(
                {
                    userId: userId
                },
                {
                    $set: {
                        sleepScore: score
                    }
                },
                {
                    sort: {
                        timestamp: -1
                    }
                }
        );

        res.json({
            success: true,
            score: score,
            data: record
        });

    } catch (err) {

        res.status(500).json({
            error: err.message
        });
    }
};