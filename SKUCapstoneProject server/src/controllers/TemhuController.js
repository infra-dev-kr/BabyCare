const TemperHumility = require('../models/TemperHumility');

// 메모리에 센서 데이터를 임시 저장할 배열 (버퍼)
let sensorBuffer = [];

/**
 * 1. 센서에서 데이터를 받아 버퍼에 넣는 함수 (IoT -> Node)
 */
exports.receiveSensorData = (req, res) => {
    const { temperature, humidity, userEmail } = req.body;

    if (temperature === undefined || humidity === undefined || !userEmail) {
        return res.status(400).json({ message: '온도, 습도 및 사용자 이메일 정보가 필요합니다.' });
    }

    sensorBuffer.push({
        userEmail,
        temperature,
        humidity,
        timestamp: new Date()
    });

    res.status(200).json({ message: '데이터가 버퍼에 저장되었습니다.' });
};

/**
 * 2. 안드로이드 앱에서 최신 데이터를 가져가는 함수 (Node -> Android)
 */
exports.getLatestData = async (req, res) => {
    const { userEmail } = req.query;

    try {
        const query = userEmail ? { userEmail } : {};
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
 * 3. 10분 단위로 그룹화된 온습도 이력을 반환하는 함수 (Node -> Android)
 */
exports.getHistoryData = async (req, res) => {
    const { userEmail } = req.query;

    if (!userEmail) {
        return res.status(400).json({ message: "사용자 이메일이 필요합니다." });
    }

    try {
        const startTime = new Date(Date.now() - 12 * 60 * 60 * 1000);

        const history = await TemperHumility.aggregate([
            {
                $match: {
                    userEmail: userEmail,
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
 * 4. 60초마다 버퍼의 데이터를 DB에 일괄 저장하는 함수 (Batch Job)
 * 설명: 실행 주기를 60초로 변경하여 DB 쓰기 성능을 최적화했습니다.
 */
exports.saveBufferToDB = async () => {
    if (sensorBuffer.length === 0) return;

    // 현재 버퍼의 내용을 복사하고 버퍼를 즉시 비움 (새로 들어올 데이터 수신을 위해)
    const dataToInsert = [...sensorBuffer];
    sensorBuffer = [];

    try {
        await TemperHumility.insertMany(dataToInsert);
        console.log(`[DB 적재 완료] 60초간 쌓인 ${dataToInsert.length}개의 데이터가 저장되었습니다.`);
    } catch (error) {
        console.error('[DB 적재 실패]', error);
        // 실패 시 데이터 유실 방지를 위해 기존 버퍼 앞에 다시 복구
        sensorBuffer = [...dataToInsert, ...sensorBuffer]; 
    }
};