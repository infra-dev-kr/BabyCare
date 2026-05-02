/**
 * soundAnalysisController.js
 * 울음 분석을 Flask 서버에 요청합니다
 */

const axios = require('axios');

class SoundAnalysisController {
  constructor() {
    this.flaskServerUrl = process.env.FLASK_SERVER_URL || 'http://127.0.0.1:5000';
    this.analysisResults = [];
    this.analysisHistory = [];
    this.audioBuffer = [];       // 최대 96000개 (2초치)
    this.audioFlag = 0;          // 0: 조용, 1: 시끄러움
    this.silentCount = 0;        // dB -40 이하 지속 횟수
    this.notCryingCount = 0;     // 울음 아닌 결과 횟수
    this.isAnalyzing = false;    // Flask 응답 기다리는 중
    this.intervalId = null;      // 타이머
  }

  // receiver.js에서 오디오 청크 받음
  // 최대 96000개(2초치) 유지, 초과하면 오래된 것 삭제
  onAudio(audioChunk) {
    const samples = new Float32Array(audioChunk.buffer);
    this.audioBuffer.push(...samples);
    if (this.audioBuffer.length > 96000) {
      this.audioBuffer.splice(0, this.audioBuffer.length - 96000);
    }
  }

  // dB 계산 -100dB(무음) ~ 0dB
  calculateDb(samples) {
    const rms = Math.sqrt(samples.reduce((s, x) => s + x * x, 0) / samples.length);
    if (rms < 1e-10) return -100;
    return 20 * Math.log10(rms);
  }

  // /start 호출되면 실행
  async startAudioAnalysis(req, res) {
    try {
      if (this.intervalId !== null) {
        return res.status(400).json({ message: '이미 실행 중' });
      }
      this.startLoop();
      res.json({ success: true, message: '음성 분석 시작' });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  // /stop 호출되면 실행, 플래그 초기화
  async stopAudioAnalysis(req, res) {
    try {
      if (this.intervalId !== null) {
        clearInterval(this.intervalId);
        this.intervalId = null;
      }
      this.audioFlag = 0;
      this.silentCount = 0;
      this.notCryingCount = 0;
      res.json({ success: true, message: '음성 분석 중지' });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  // 1초마다 dB 체크, 1초마다 Flask 호출
  startLoop() {
    this.intervalId = setInterval(async () => {
      if (this.audioBuffer.length === 0) return;

      const samples = new Float32Array(this.audioBuffer);
      const db = this.calculateDb(samples);

      if (db > -40) {
        this.audioFlag = 1;
        this.silentCount = 0;
      } else {
        this.silentCount++;
      }

      if (this.audioFlag === 1 && !this.isAnalyzing) {
        await this.requestAudioFlaskAnalysis();
      }

      // 종료 조건: dB -40 이하 10초(10번) 이상 AND 울음 아닌 결과 10번 이상
      if (this.silentCount >= 10 && this.notCryingCount >= 10) {
        console.log('[SoundAnalysisController] 조용해짐. audioFlag 0으로 변경');
        this.audioFlag = 0;
        this.silentCount = 0;
        this.notCryingCount = 0;
      }

    }, 1000);
  }

  // Flask로 오디오 버퍼 전송
  async requestAudioFlaskAnalysis() {
    try {
      this.isAnalyzing = true;

      const buffer = Buffer.from(new Float32Array(this.audioBuffer).buffer);

      const response = await axios.post(
        `${this.flaskServerUrl}/api/audio/analyze`,
        buffer,
        {
          timeout: 60000,
          headers: { 'Content-Type': 'application/octet-stream' }
        }
      );

      const analysisResult = {
        timestamp: Date.now(),
        result: response.data,
        receivedAt: Date.now(),
        status: 'success'
      };

      this.analysisResults.push(analysisResult);
      this.analysisHistory.push(analysisResult);

      // 최근 50개 결과만 유지
      if (this.analysisResults.length > 50) {
        this.analysisResults.shift();
      }

      if (!response.data.data.cry_detected) {
        this.notCryingCount++;
      } else {
        this.notCryingCount = 0;
      }

      // console.log('[SoundAnalysisController] 울음 분석 결과:', response.data);
      if (response.data.data.cry_detected === true) {
        console.log("울음")
      }

    } catch (error) {
      //console.error('[SoundAnalysisController] Flask 분석 실패:', error.message);
      const errorResult = {
        timestamp: Date.now(),
        error: error.message,
        status: 'failed'
      };
      this.analysisHistory.push(errorResult);

    } finally {
      this.isAnalyzing = false;
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
      console.error('[SoundAnalysisController] 결과 조회 실패:', error.message);
      res.status(500).json({
        success: false,
        message: '결과 조회 실패',
        error: error.message
      });
    }
  }

  /**
   * 분석 히스토리 조회
   */
  getAnalysisHistory(req, res) {
    try {
      const limit = req.query.limit ? parseInt(req.query.limit) : 20;
      const history = this.analysisHistory.slice(-limit);

      res.json({
        success: true,
        count: history.length,
        total: this.analysisHistory.length,
        history: history
      });
    } catch (error) {
      console.error('[SoundAnalysisController] 히스토리 조회 실패:', error.message);
      res.status(500).json({
        success: false,
        message: '히스토리 조회 실패',
        error: error.message
      });
    }
  }

  /**
   * 특정 날짜의 분석 결과 조회
   */
  getResultsByDate(req, res) {
    try {
      const { date } = req.params;
      const targetDate = new Date(date).getTime();
      const dayInMs = 24 * 60 * 60 * 1000;

      const filtered = this.analysisHistory.filter(item => {
        if (!item.timestamp) return false;
        return item.timestamp >= targetDate && item.timestamp < targetDate + dayInMs;
      });

      res.json({
        success: true,
        date: date,
        count: filtered.length,
        results: filtered
      });
    } catch (error) {
      console.error('[SoundAnalysisController] 날짜별 조회 실패:', error.message);
      res.status(500).json({
        success: false,
        message: '날짜별 조회 실패',
        error: error.message
      });
    }
  }
}

module.exports = new SoundAnalysisController();