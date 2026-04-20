const axios = require('axios');
const SmartThings = require('../models/SmartThings');
const User = require('../models/User'); // 유저 확인용

/**
 * 1. SmartThings PAT 토큰 등록 및 기기 동기화
 * POST /api/smartthings/register
 */
exports.registerSmartThings = async (req, res) => {
    const { token, email } = req.body;
    const userId = req.user.id; // verifyToken 미들웨어에서 넘어온 유저 ID

    console.log(`\n[ST_PROCESS] ======= 🛠️ 스마트싱스 연동 시작 =======`);
    console.log(`[ST_INFO] 요청 유저: ${email} (${userId})`);

    // [Step 1] 입력값 검증 (Sanitization)
    if (!token || token.length < 10) {
        console.error(`[ST_ERROR] 유효하지 않은 PAT 토큰 형식`);
        return res.status(400).json({ ok: false, message: '유효한 SmartThings 토큰을 입력해주세요.' });
    }

    try {
        // [Step 2] 실제 존재하는 유저인지 더블 체크
        const userExists = await User.findById(userId);
        if (!userExists) {
            return res.status(404).json({ ok: false, message: '사용자 정보를 찾을 수 없습니다.' });
        }

        // [Step 3] 삼성 서버에 기기 목록 요청 (토큰 유효성 검사 겸용)
        console.log(`[ST_API] 삼성 서버로 기기 목록 요청 중...`);
        const stResponse = await axios.get('https://api.smartthings.com/v1/devices', {
            headers: { 
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            timeout: 7000 // 7초 타임아웃 설정
        });

        const devices = stResponse.data.items || [];
        console.log(`[ST_API] ✅ 삼성 서버 응답 성공! 발견된 기기: ${devices.length}개`);

        // [Step 4] DB 업데이트 (기존 데이터가 있으면 갱신, 없으면 생성 - Upsert)
        const updatedData = await SmartThings.findOneAndUpdate(
            { userId: userId },
            { 
                userEmail: email,
                patToken: token, 
                deviceCount: devices.length,
                updatedAt: Date.now() 
            },
            { upsert: true, new: true, setDefaultsOnInsert: true }
        );

        console.log(`[ST_DB] ✨ MongoDB 저장 완료 (ID: ${updatedData._id})`);

        // [Step 5] 안드로이드가 쓰기 편하게 기기 목록 가공
        const mappedDevices = devices.map(device => ({
            deviceId: device.deviceId,
            name: device.name,
            label: device.label || device.name, // 별칭 없으면 기본이름
            deviceTypeName: device.deviceTypeName,
            locationId: device.locationId
        }));

        res.status(200).json({
            ok: true,
            message: 'SmartThings 연동 및 기기 동기화가 완료되었습니다.',
            devices: mappedDevices
        });

    } catch (error) {
        console.error(`\n[ST_CRITICAL_ERROR] ❌ 연동 실패 상세 로그:`);
        
        if (error.response) {
            // 삼성 서버에서 에러를 뱉은 경우 (토큰 만료 등)
            console.error(`- 삼성 API 에러 코드: ${error.response.status}`);
            console.error(`- 에러 내용:`, error.response.data);
            return res.status(401).json({ ok: false, message: '삼성 인증 토큰이 유효하지 않거나 만료되었습니다.' });
        } else if (error.request) {
            // 삼성 서버 응답이 없는 경우 (네트워크 문제)
            console.error(`- 네트워크 타임아웃 또는 삼성 서버 응답 없음`);
            return res.status(503).json({ ok: false, message: '삼성 서버와 통신할 수 없습니다. 잠시 후 다시 시도해주세요.' });
        } else {
            // 코드 실행 중 발생한 기타 에러
            console.error(`- 내부 로직 에러: ${error.message}`);
            res.status(500).json({ ok: false, message: '서버 내부 처리 중 오류가 발생했습니다.' });
        }
    }
};

/**
 * 2. 등록된 기기 목록 실시간 새로고침
 * GET /api/smartthings/devices
 */
exports.getUserDevices = async (req, res) => {
    try {
        const userId = req.user.id;
        
        // DB에서 저장된 PAT 토큰 가져오기
        const stInfo = await SmartThings.findOne({ userId: userId });
        if (!stInfo || !stInfo.patToken) {
            return res.status(200).json({ ok: true, devices: [], message: '연동된 기기가 없습니다.' });
        }

        // 저장된 토큰으로 삼성 서버 실시간 조회
        const response = await axios.get('https://api.smartthings.com/v1/devices', {
            headers: { 'Authorization': `Bearer ${stInfo.patToken}` }
        });

        const devices = response.data.items.map(d => ({
            deviceId: d.deviceId,
            label: d.label || d.name,
            status: 'online' // 실제 상태는 별도 API 필요
        }));

        res.status(200).json({ ok: true, devices });

    } catch (error) {
        console.error(`[ST_GET_ERROR] 기기 목록 로드 실패: ${error.message}`);
        // 토큰이 그사이 만료된 경우 401 처리
        if (error.response && error.response.status === 401) {
            return res.status(401).json({ ok: false, message: '인증이 만료되었습니다. 다시 연동해주세요.' });
        }
        res.status(500).json({ ok: false, message: '기기 목록을 가져오는 중 오류가 발생했습니다.' });
    }
};