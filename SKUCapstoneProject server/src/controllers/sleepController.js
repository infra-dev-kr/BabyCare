const { MLR } = require('ml-regression');
const Sleep = require('../models/Sleep');

let sleepModel = null;

// Y = 100 - (6*|T-23|) - (0.5*|H-50|) - (1*|N-40|) - 45*a
const calcScore = (temp, humidity, noise, isCrying) => {
    let score = 100;
    score -= 6 * Math.abs(temp - 23);
    score -= 0.5 * Math.abs(humidity - 50);
    score -= 1 * Math.abs(noise - 40);
    score -= 45 * (isCrying ? 1 : 0);
    return Math.max(0, Math.min(100, Math.round(score)));
};

// [Step 1] Seed 데이터 생성
exports.seedMLData = async (req, res) => {
    try {
        const dummyData = [];
        for (let i = 0; i < 200; i++) {
            const temp     = 18 + Math.random() * 12;     // 18~30도
            const noise    = 20 + Math.random() * 50;     // 20~70dB
            const humidity = 30 + Math.random() * 50;     // 30~80%
            const isCrying = Math.random() > 0.85 ? 1 : 0;
            const actualScore = calcScore(temp, humidity, noise, isCrying);

            dummyData.push({ temp, noise, humidity, isCrying, actualScore });
        }
        await Sleep.deleteMany({ actualScore: { $exists: true } });
        await Sleep.insertMany(dummyData);
        res.json({ message: '학습 데이터 생성 완료' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// [Step 2] 모델 학습
const trainSleepModel = async () => {
    const data = await Sleep.find({ actualScore: { $exists: true } });
    if (data.length < 50) return null;

    const X = data.map(d => [d.temp, d.humidity, d.noise, d.isCrying || 0]);
    const y = data.map(d => d.actualScore);

    sleepModel = new MLR(X, y);
    console.log('✅ 수면 모델 학습 완료');
};

// [Step 3] 분석 결과를 받아서 수면 점수 계산 (Flask 분석 결과 연동)
// videoController / soundController의 분석 결과를 여기서 받음
exports.recordAnalysisResult = async (req, res) => {
    try {
        const { temp, humidity, noise, isCrying } = req.body;

        if (temp === undefined || humidity === undefined || noise === undefined) {
            return res.status(400).json({ message: 'temp, humidity, noise 필수입니다.' });
        }

        const score = calcScore(temp, humidity, noise, isCrying);

        const record = new Sleep({
            temp,
            humidity,
            noise,
            isCrying: isCrying ? 1 : 0,
            actualScore: score,
            createdAt: new Date()
        });
        await record.save();

        res.json({
            success: true,
            score,
            status: score > 80 ? '쾌적' : score > 60 ? '보통' : '주의',
            data: record
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// [Step 4] 실시간 분석 조회 (안드로이드에서 호출)
exports.getSleepAnalysis = async (req, res) => {
    try {
        if (!sleepModel) await trainSleepModel();

        const recentRecords = await Sleep.find().sort({ createdAt: -1 }).limit(10);

        const analyzed = recentRecords.map(curr => {
            // ML 모델이 있으면 예측값, 없으면 수식으로 직접 계산
            let score;
            if (sleepModel) {
                const predicted = sleepModel.predict([
                    curr.temp,
                    curr.humidity || 50,
                    curr.noise || 40,
                    curr.isCrying || 0
                ]);
                score = Math.max(0, Math.min(100, Math.round(predicted)));
            } else {
                score = calcScore(curr.temp, curr.humidity || 50, curr.noise || 40, curr.isCrying || 0);
            }

            return {
                ...curr._doc,
                score,
                status: score > 80 ? '쾌적' : score > 60 ? '보통' : '주의'
            };
        });

        res.json({ success: true, data: analyzed });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// [Step 5] GPT 리포트용 데이터
exports.getReportPayload = async (req, res) => {
    try {
        const last24h = await Sleep.find({
            createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
        });

        if (last24h.length === 0) {
            return res.status(404).json({ message: '분석할 데이터가 없습니다.' });
        }

        const avgTemp     = (last24h.reduce((a, b) => a + b.temp, 0) / last24h.length).toFixed(1);
        const avgHumidity = (last24h.reduce((a, b) => a + b.humidity, 0) / last24h.length).toFixed(1);
        const maxNoise    = Math.max(...last24h.map(d => d.noise));
        const cryCount    = last24h.filter(d => d.isCrying === 1).length;
        const avgScore    = (last24h.reduce((a, b) => a + b.actualScore, 0) / last24h.length).toFixed(1);

        res.json({
            prompt: `소아과 전문가 관점에서 아기의 수면 환경 리포트를 작성해 주세요.
분석 데이터: 평균 온도 ${avgTemp}도, 평균 습도 ${avgHumidity}%, 최대 소음 ${maxNoise}dB, 울음 감지 ${cryCount}회, 평균 수면 점수 ${avgScore}점.
환경 개선점과 수면 질에 대한 종합 의견을 주되, 전문적이면서 친절한 말투로 작성해 주세요.`,
            data: { avgTemp, avgHumidity, maxNoise, cryCount, avgScore }
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};