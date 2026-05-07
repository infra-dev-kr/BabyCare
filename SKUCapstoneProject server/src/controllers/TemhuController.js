const TemperHumility = require('../models/TemperHumility');

let sensorBuffer = [];

/**
 * 1. IoT → Node.js 데이터 수신
 */
exports.receiveSensorData = (req, res) => {
    const { temperature, humidity, userId } = req.body;

    if (temperature === undefined || humidity === undefined || !userId) {
        return res.status(400).json({ message: '온도, 습도 및 사용자 ID 정보가 필요합니다.' });
    }

    sensorBuffer.push({
        userId: userId,  // ✅ 스키마 필드명 통일
        temperature,
        humidity,
        timestamp: new Date()
    });

    console.log(`[버퍼 저장] userId: ${userId}, 온도: ${temperature}, 습도: ${humidity}`);
    res.status(200).json({ message: '데이터가 버퍼에 저장되었습니다.' });
};

/**
 * 2. Android → 최신 데이터 조회
 */
exports.getLatestData = async (req, res) => {
    const { userId } = req.query;

    try {  // ✅ 오타 제거
        const query = userId ? { userId: userId } : {};  // ✅ 필드명 통일
        const latestData = await TemperHumility.findOne(query).sort({ timestamp: -1 });

        if (!latestData) {
            return res.status(404).json({ message: "저장된 데이터가 없습니다." });
        }

        res.status(200).json(latestData);
    } catch (error) {
        res.status(500).json({ message: "데이터 조회 중 오류 발생", error: error.message });
    }
};

/**
 * 3. Android → 12시간 이력 조회 (10분 단위)
 */
exports.getHistoryData = async (req, res) => {
    const { userId } = req.query;

    if (!userId) {
        return res.status(400).json({ message: "사용자 ID가 필요합니다." });
    }

    try {
        const startTime = new Date(Date.now() - 12 * 60 * 60 * 1000);

        const history = await TemperHumility.aggregate([
            {
                $match: {
                    userId: userId,  // ✅ 필드명 통일
                    timestamp: { $gte: startTime }
                }
            },
            {
                $group: {
                    _id: {
                        timestamp: {
                            $subtract: [
                                { $toLong: "$timestamp" },
                                { $mod: [{ $toLong: "$timestamp" }, 10 * 60 * 1000] }
                            ]
                        }
                    },
                    avgTemp: { $avg: "$temperature" },
                    avgHum: { $avg: "$humidity" }
                }
            },
            { $sort: { "_id.timestamp": 1 } }
        ]);

        const formattedData = history.map(item => ({
            time: new Date(item._id.timestamp),
            temperature: Math.round(item.avgTemp * 10) / 10,
            humidity: Math.round(item.avgHum * 10) / 10
        }));

        res.status(200).json(formattedData);
    } catch (error) {
        res.status(500).json({ message: "이력 조회 중 오류 발생", error: error.message });
    }
};

/**
 * 4. 10분마다 버퍼 → MongoDB 저장
 */
exports.saveBufferToDB = async () => {
    if (sensorBuffer.length === 0) return;

    const dataToInsert = [...sensorBuffer];
    sensorBuffer = [];

    try {
        await TemperHumility.insertMany(dataToInsert);
        console.log(`[DB 적재 완료] ${dataToInsert.length}개 저장됨.`);
    } catch (error) {
        console.error('[DB 적재 실패]', error);
        sensorBuffer = [...dataToInsert, ...sensorBuffer];
    }
};