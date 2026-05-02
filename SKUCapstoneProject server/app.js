require('dotenv').config();
const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const dgram = require('dgram');
const axios = require('axios');
const path = require('path')

// DB 연결
const { connectDB } = require('./src/db');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

app.set('wss', wss);

const PORT = process.env.PORT || 3001;

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

//receiver.js => rpi와 연결
const receiver = require('./src/receiver')

// ==========================================
// 라우터 설정
// ==========================================
const authRouter = require('./src/routes/authRoutes');
const policyRouter = require('./src/routes/policyRoutes');
const vaccineRouter = require('./src/routes/vaccineRoutes');
const sleepRoutes = require('./src/routes/sleepRoutes');
const smartThingsRouter = require('./src/routes/smartThingsRoutes');
const videoRoutes = require('./src/routes/videoRoutes');
const soundAnalysisRoutes = require('./src/routes/Soundanalysisroutes');
const aiRouter = require('./src/routes/airouter'); 

app.use('/auth', authRouter);
app.use('/api/policies', policyRouter);
app.use('/api/vaccines', vaccineRouter);
app.use('/api/Sleep', sleepRoutes);
app.use('/api/SmartThings', smartThingsRouter);
app.use('/api/video', videoRoutes);
app.use('/api/sound-analysis', soundAnalysisRoutes);
app.use('/api/ai', aiRouter); 

// HLS 스트리밍 파일 서빙
app.use('/stream', express.static(path.join(__dirname, 'public/stream')))

// ==========================================
// 🧪 [TEST] Flask 서버 통신 테스트 라우트
// ==========================================
app.get('/api/test-ai-bridge', async (req, res) => {
    console.log("🧪 [Test] Flask 서버로 통신 테스트 시작...");
    
    const dummyData = {
        image: "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", 
        camera_id: "test_camera_001"
    };

    try {
        const health = await axios.get('http://127.0.0.1:5000/health');
        console.log("✅ 1. Flask Health Check:", health.data.status);

        const aiRes = await axios.post('http://127.0.0.1:5000/api/video/analyze', dummyData);
        console.log("✅ 2. Flask AI 응답 성공:", aiRes.data);

        res.json({
            success: true,
            message: "Node.js에서 Flask로 데이터 쏘기 성공!",
            flask_response: aiRes.data
        });
    } catch (error) {
        console.error("❌ [Test] 통신 실패:", error.message);
        res.status(500).json({
            success: false,
            message: "Flask 서버와 통신 불가 (서버가 켜져있는지 확인하세요)",
            error: error.message
        });
    }
});

// ==========================================
// 서버 실행
// ==========================================
app.get('/', (req, res) => res.send('🚀 Capstone AI Server Running'));

// connectDB()
//     .then(() => {
        server.listen(PORT, () => {
            console.log('==============================================');
            console.log(`✅ MongoDB 연결 성공`);
            receiver.init(wss)
            axios.post(`http://localhost:${PORT}/api/video/start`)
            axios.post(`http://localhost:${PORT}/api/sound-analysis/start`)
            console.log(`🚀 서버 실행 중: http://localhost:${PORT}`);
            console.log(`🧪 테스트 주소: http://localhost:${PORT}/api/test-ai-bridge`);
            console.log('==============================================');
        });
    // })
    // .catch((err) => {
    //     console.error("❌ 서버 시작 실패:", err.message);
    // });