const { MLR } = require('ml-regression');
const Sleep = require('../models/Sleep');
const aiController = require('./aiController'); // ✅ aiModel 대신 aiController 호출

let sleepModel = null;

const calcScore = (temp, humidity, noise, isCrying) => {
    let score = 100;
    score -= 6 * Math.abs(temp - 23);
    score -= 0.5 * Math.abs(humidity - 50);
    score -= 1 * Math.abs(noise - 40);
    score -= 45 * (isCrying ? 1 : 0);
    return Math.max(0, Math.min(100, Math.round(score)));
};

exports.processHourlyBatch = async () => {
    try {
        const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

        const stats = await Sleep.aggregate([
            { $match: { createdAt: { $gte: oneHourAgo } } },
            { $group: {
                _id: null,
                avgT: { $avg: "$temp" },
                avgH: { $avg: "$humidity" },
                avgN: { $avg: "$noise" },
                cryingCount: { $sum: "$isCrying" }
            }}
        ]);

        if (stats.length === 0) return console.log("집계할 데이터가 없습니다.");

        const { avgT, avgH, avgN, cryingCount } = stats[0];
        const hourlyScore = calcScore(avgT, avgH, avgN, cryingCount > 0);

        const summaryRecord = new Sleep({
            temp: avgT.toFixed(1),
            humidity: avgH.toFixed(1),
            noise: avgN.toFixed(1),
            isCrying: cryingCount > 0 ? 1 : 0,
            actualScore: hourlyScore,
            createdAt: new Date()
        });

        await summaryRecord.save();
        console.log(`[Batch] ${new Date().getHours()}시 집계 완료: ${hourlyScore}점`);
    } catch (err) {
        console.error("Hourly Batch 에러:", err);
    }
};

// ✅ app.js에서 호출하는 함수명 통일
exports.generateDailyComprehensiveReport = async () => {
    console.log("🌅 8시 GPT 리포트 생성 시작...");
    await aiController.generateDailyReport(); // ✅ aiController로 위임
};

exports.recordAnalysisResult = async (req, res) => {
    try {
        const { temp, humidity, noise, isCrying } = req.body;
        const score = calcScore(temp, humidity, noise, isCrying);
        const record = new Sleep({
            temp, humidity, noise, isCrying: isCrying ? 1 : 0,
            actualScore: score, createdAt: new Date()
        });
        await record.save();
        res.json({ success: true, score, data: record });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

exports.seedMLData = async (req, res) => { /* 기존 코드 */ };
const trainSleepModel = async () => { /* 기존 코드 */ };
exports.getSleepAnalysis = async (req, res) => { /* 기존 코드 */ };