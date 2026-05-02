/**
 * videoController.js
 * IoT 카메라 영상 수신, Android 전송, Flask 분석 관리
 */

const axios = require('axios');

class VideoController {
  constructor() {
    this.currentFrame = null;
    this.frameTimestamp = null;
    this.analysisInterval = 10000; // 10초
    this.analysisIntervalId = null;
    this.androidClients = new Set();
    this.flaskServerUrl = process.env.FLASK_SERVER_URL || 'http://127.0.0.1:5000';
    this.analysisResults = [];
    this.frameBuffer = [];
  }

  // receiver.js에서 8888포트로 들어온 영상을 프레임만 보내줌
  // 10프레임을 쌓고 먼저 들어온거 버리기(10프레임 분석을 위함 > 연산량문제있으면 줄여도)
  onFrame(videoFrame) {
    this.currentFrame = videoFrame;
    this.frameTimestamp = Date.now();
    this.frameBuffer.push(videoFrame);
    if (this.frameBuffer.length > 10) {
      this.frameBuffer.shift();
    }
  }

  async startAnalysis(req, res) {
    try {
      if (this.analysisIntervalId !== null) {
        return res.status(400).json({ message: '이미 실행 중' });
      }
      this.startFlaskAnalysis();
      res.json({ success: true, message: '분석 시작' });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  async stopAnalysis(req, res) {
    try {
      if (this.analysisIntervalId !== null) {
        clearInterval(this.analysisIntervalId);
        this.analysisIntervalId = null;
      }
      res.json({ success: true, message: '분석 중지' });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  /**
   * 10초마다 Flask로 분석 요청 시작
   * @private
   */
  startFlaskAnalysis() {
    if (this.analysisIntervalId !== null) {
      return;
    }
    console.log('[VideoController] Flask 비디오 분석 시작 (10초 간격)');
    // 즉시 한 번 실행
    this.requestFlaskAnalysis();
    // 10초마다 실행
    this.analysisIntervalId = setInterval(() => {
      this.requestFlaskAnalysis();
    }, this.analysisInterval);
  }

  /**
   * Flask 서버로 현재 프레임 분석 요청
   * @private
   */
  async requestFlaskAnalysis() {
    try {
      // 10장을 동시에 보내기 위함(객체인식의 정확도를 위함)
      // 버퍼가 쌓였는지 확인
      if (this.frameBuffer.length < 10) {
        console.warn('[VideoController] 프레임 부족');
        return;
      }
      // sharp를 이용해 프레임들을 jpeg형태로 변환 > 결과 : base64
      const sharp = require('sharp');
      const frames = await Promise.all(
        this.frameBuffer.map(f =>
          sharp(f, { raw: { width: 1280, height: 720, channels: 3 } })
            .jpeg()
            .toBuffer()
            .then(buf => buf.toString('base64'))
        )
      );
      // flask로 post
      const response = await axios.post(
        `${this.flaskServerUrl}/api/video/analyze`,
        { frames, timestamp: this.frameTimestamp },
        { timeout: 30000, headers: { 'Content-Type': 'application/json' } }
      );
      const analysisResult = {
        timestamp: this.frameTimestamp,
        result: response.data,
        receivedAt: Date.now()
      };
      this.analysisResults.push(analysisResult);
      // 최근 100개만 유지
      if (this.analysisResults.length > 100) {
        this.analysisResults.shift();
      }
      //console.log('[VideoController] Flask 분석 결과:', response.data);
      if (response.data.data.result.infant_detected === true) {
        console.log("아기 감지")
      }
      // Android 클라이언트에게 분석 결과 전송
      this.broadcastAnalysisResult(analysisResult);
    } catch (error) {
      console.error('[VideoController] Flask 분석 요청 실패:', error.message);
    }
  }

  /**
   * 분석 결과를 Android 클라이언트에게 전송
   */
  broadcastAnalysisResult(result) {
    const payload = {
      type: 'analysisResult',
      data: result
    };
    this.androidClients.forEach((ws) => {
      if (ws.readyState === 1) {
        try {
          ws.send(JSON.stringify(payload));
        } catch (error) {
          //console.error('[VideoController] 분석 결과 전송 실패:', error.message);
          this.androidClients.delete(ws);
        }
      }
    });
  }

  /**
   * 현재 프레임 조회 (HTTP)
   */
  getCurrentFrame(req, res) {
    try {
      if (!this.currentFrame) {
        return res.status(404).json({ message: '현재 프레임이 없습니다' });
      }
      const sharp = require('sharp');
      sharp(this.currentFrame, { raw: { width: 1280, height: 720, channels: 3 } })
        .jpeg()
        .toBuffer()
        .then(buf => {
          res.set('Content-Type', 'image/jpeg');
          res.send(buf);
        })
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  /**
   * 분석 결과 조회
   */
  getAnalysisResults(req, res) {
    try {
      res.json({
        success: true,
        count: this.analysisResults.length,
        results: this.analysisResults
      });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  /**
   * Android WebSocket 클라이언트 추가
   */
  addAndroidClient(ws) {
    this.androidClients.add(ws);
    console.log(`[VideoController] Android 클라이언트 연결 (${this.androidClients.size}개)`);
  }

  /**
   * Android WebSocket 클라이언트 제거
   */
  removeAndroidClient(ws) {
    this.androidClients.delete(ws);
    console.log(`[VideoController] Android 클라이언트 제거 (${this.androidClients.size}개)`);
  }

  /**
   * 스트림 상태 조회
   */
  getStreamStatus(req, res) {
    try {
      res.json({
        success: true,
        frameTimestamp: this.frameTimestamp,
        analysisResultsCount: this.analysisResults.length,
        flaskServerUrl: this.flaskServerUrl
      });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  }
}

module.exports = new VideoController();