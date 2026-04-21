require('dotenv').config();

const express = require('express');
const { connectDB } = require('./src/db'); 
const app = express();

const PORT = process.env.PORT || 3000;

// 미들웨어 설정
app.use(express.json());
app.use((req, res, next) => {
    console.log(`[${new Date().toLocaleString()}] 📢 요청 들어옴: ${req.method} ${req.url}`);
    next();
});
app.use(express.urlencoded({ extended: true }));

// [라우터 연결]
const authRouter = require('./src/routes/authRoutes');
const policyRouter = require('./src/routes/policyRoutes'); 
const vaccineRouter = require('./src/routes/vaccineRoutes'); 
const sleepRoutes = require('./src/routes/sleepRoutes'); 
const smartThingsRouter = require('./src/routes/smartThingsRoutes'); 

// 🤖 AI 리포트 추가: 1. 라우터 파일 가져오기
const aiRouter = require('./src/routes/airouter'); 

// 기존 인증 라우터
app.use('/auth', authRouter);

// 복지 정책 라우터
app.use('/api/policies', policyRouter);

// 예방접종 스케줄 라우터
app.use('/api/vaccines', vaccineRouter);

// 애기 수면 점수 
app.use('/api/Sleep', sleepRoutes);

// SmartThings 라우터 등록
app.use('/api/SmartThings', smartThingsRouter);

// 🤖 AI 리포트 추가: 2. AI 라우터 등록 (큰 길 지정)
// 이제 안드로이드에서 /api/ai/generate 로 요청을 보낼 수 있습니다.
app.use('/api/ai', aiRouter);


// 기본 접속 테스트
app.get('/', (req, res) => {
    res.send('Hello! Capstone Server is Running 🚀');
});


connectDB()
    .then(() => {
        app.listen(PORT, () => {
            console.log(`---------------------------------------`);
            console.log(`🚀 서버가 http://localhost:${PORT} 에서 대기 중입니다.`);
            console.log(`🚀 데이터베이스 연결 성공`);
            console.log(`🚀 정책 API: http://localhost:${PORT}/api/policies`);
            console.log(`🚀 예방접종 API: http://localhost:${PORT}/api/vaccines/schedule/:userId`);
            console.log(`🚀 SmartThings API: http://localhost:${PORT}/api/smartthings/register`);
            
            // 🤖 AI 리포트 추가: 3. 확인용 로그 추가
            console.log(`🚀 AI 리포트 API: http://localhost:${PORT}/api/ai/generate`);
            console.log(`---------------------------------------`);
        });
    })
    .catch((err) => {
        console.error("❌ 서버 시작 실패 (DB 연결 오류):", err.message);
        process.exit(1);
    });