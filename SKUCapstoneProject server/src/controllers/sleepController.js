const { MLR } = require('ml-regression');
const Sleep = require('../models/Sleep');
const aiModel = require('../models/ai');

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

// [Step 5] GPT 리포트 직접 생성 (ai.js 모듈 호출)
exports.getReportPayload = async (req, res) => {
    try {
        // 1. 최근 24시간 데이터 가져오기
        const last24h = await Sleep.find({
            createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
        });

        if (last24h.length === 0) {
            return res.status(404).json({ message: '분석할 데이터가 없습니다.' });
        }

        // 2. AI에게 전달할 데이터 양식으로 가공하기 (배열에서 통계 추출)
        const temps = last24h.map(d => d.temp);
        const humidities = last24h.map(d => d.humidity);
        const noises = last24h.map(d => d.noise);
        const scores = last24h.map(d => d.actualScore);

        // 수면 상태 횟수 카운트
        const comfortable = scores.filter(s => s > 80).length;
        const normal = scores.filter(s => s > 60 && s <= 80).length;
        const caution = scores.filter(s => s <= 60).length;

        // 조도 데이터는 스키마에 없으므로 기본값 0 할당
        const reportData = {
            reportType: "일간 수면 환경 리포트",
            periodStart: new Date(Date.now() - 24 * 60 * 60 * 1000).toLocaleString('ko-KR'),
            periodEnd: new Date().toLocaleString('ko-KR'),
            environment: {
                avgTemp: (temps.reduce((a, b) => a + b, 0) / temps.length).toFixed(1),
                minTemp: Math.min(...temps).toFixed(1),
                maxTemp: Math.max(...temps).toFixed(1),
                avgHumidity: (humidities.reduce((a, b) => a + b, 0) / humidities.length).toFixed(1),
                minHumidity: Math.min(...humidities).toFixed(1),
                maxHumidity: Math.max(...humidities).toFixed(1),
                avgNoise: (noises.reduce((a, b) => a + b, 0) / noises.length).toFixed(1),
                maxNoise: Math.max(...noises).toFixed(1),
                avgLight: 0 
            },
            sleep: {
                avgSleepScore: (scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(1),
                bestSleepScore: Math.max(...scores),
                worstSleepScore: Math.min(...scores),
                statusSummary: { comfortable, normal, caution },
                avgSleepDuration: 24 // 임시값: 현재 데이터상 정확한 수면 지속 시간 판별 로직은 없으므로
            }
        };

        // 3. 만들어둔 ai.js의 함수를 호출하여 리포트 생성
        const reportContent = await aiModel.generateAiReport(reportData);

        // 4. 안드로이드 클라이언트로 최종 리포트 결과 전송
        res.status(200).json({
            success: true,
            message: "AI 리포트가 성공적으로 생성되었습니다.",
            report: reportContent 
        });

    } catch (err) {
        console.error("AI 리포트 생성 에러:", err);
        res.status(500).json({ error: err.message });
    }
};