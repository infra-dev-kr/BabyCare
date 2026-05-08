const express = require('express');
const router = express.Router();
const temhuController = require('../controllers/TemhuController');

// IoT → 데이터 전송
router.post('/', (req, res) => {
    const io = req.app.get('io');
    temhuController.receiveSensorData(
        req,
        res,
        io
    );
});

// Android → 최신 데이터
router.get(
    '/latest',
    temhuController.getLatestData
);

// Android → 온습도 이력
router.get(
    '/history',
    temhuController.getHistoryData
);

// Android → 수면점수 그래프 데이터
router.get(
    '/sleep-score-history',
    temhuController.getSleepScoreHistory
);

module.exports = router;