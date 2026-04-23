from flask import Flask, jsonify, request
from flask_cors import CORS
import time
import av
from datetime import datetime
import traceback

# config.py의 설정값들을 가져옵니다.
import config 
from config import (
    FLASK_HOST, FLASK_PORT, DEBUG,
    DEFAULT_STREAM_URL, DEFAULT_ANALYSIS_DURATION
)

# 폴더 구조에 맞춰 엔진과 유틸리티 임포트
from .engines.audio_engine import AudioEngine
from .engines.video_engine import VideoEngine
from .utils import normalize_result, log_debug, wrap_node_response

app = Flask(__name__)
# 노드 서버(3001)와의 원활한 통신을 위한 CORS 허용
CORS(app)

# ==============================
# Engine Singleton Manager
# ==============================
class EngineManager:
    audio = None
    video = None

def init_engines():
    """AI 엔진들을 메모리에 1회 로드합니다."""
    if EngineManager.audio is None:
        EngineManager.audio = AudioEngine()
    if EngineManager.video is None:
        EngineManager.video = VideoEngine()
    print("[Flask] Engines initialized")

# ==============================
# Stream Collector (PyAV 로직)
# ==============================
def collect_stream(stream_url, duration, audio_eng, video_eng):
    """지정한 주소에서 스트림을 직접 수집하여 엔진 버퍼에 쌓습니다."""
    container = None
    start_time = time.time()
    try:
        print(f"[Collector] connecting: {stream_url}")
        container = av.open(stream_url, options={
            "timeout": "5000000",
            "buffer_size": "1024000"
        })

        for frame in container.decode():
            if time.time() - start_time > duration:
                print("[Collector] timeout reached")
                break
            try:
                if isinstance(frame, av.AudioFrame):
                    audio_eng.add_audio_frame(frame.to_ndarray().astype("float32"))
                elif isinstance(frame, av.VideoFrame):
                    video_eng.add_video_frame(frame.to_ndarray(format="rgb24"))
            except Exception as e:
                print("[Collector] frame error:", e)
                continue
        print("[Collector] finished")
    except Exception as e:
        print("[Collector] stream error:", e)
    finally:
        if container:
            try: container.close()
            except: pass

# ==============================
# SAFE ENGINE WRAPPER
# ==============================
def safe_engine_call(func, *args, **kwargs):
    try:
        return func(*args, **kwargs)
    except Exception as e:
        print("[Engine error]", e)
        return None

# ==============================
# API ROUTES (Node.js 서버와 연동)
# ==============================

@app.route("/health", methods=["GET"])
def health():
    """서버 상태 확인용"""
    return jsonify({
        "status": "healthy",
        "timestamp": datetime.now().isoformat(),
        "models": {
            "yolo": config.YOLO_OK,
            "audio": config.CRY_OK
        }
    })

@app.route("/models", methods=["GET"])
def models():
    """사용 중인 모델 정보 확인용"""
    init_engines()
    return jsonify({
        "audio_model": "baby_cry_model_v3",
        "video_model": "yolo + face engine",
        "status": "loaded"
    })

# 1. BATCH ANALYSIS (STREAM) - 특정 시간 모아서 분석
@app.route("/api/analyze", methods=["POST"])
def analyze_batch():
    try:
        init_engines()
        data = request.json or {}
        stream_url = data.get("stream_url", DEFAULT_STREAM_URL)
        duration = data.get("duration", DEFAULT_ANALYSIS_DURATION)

        audio = EngineManager.audio
        video = EngineManager.video
        audio.reset()
        video.reset()

        collect_stream(stream_url, duration, audio, video)

        audio_result = safe_engine_call(audio.analyze)
        video_result = safe_engine_call(video.analyze)

        result = {
            "infant_detected": False,
            "age_label": None,
            "confidence": None,
            "cry_detected": False,
            "cry_events": [],
            "noise_events": [],
            "status": "completed",
            "duration": time.time()
        }
        
        if audio_result:
            result["cry_events"] = audio_result.get("cry_events", [])
            result["noise_events"] = audio_result.get("noise_events", [])
            result["cry_detected"] = len(result["cry_events"]) > 0
        if video_result:
            result["infant_detected"] = video_result.get("infant_detected")
            result["age_label"] = video_result.get("age_label")
            result["confidence"] = video_result.get("confidence")

        return jsonify({
            "success": True,
            "data": normalize_result(result)
        })
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

# 2. NODE.JS REALTIME VIDEO API - [수정됨: /api 추가]
@app.route("/api/video/analyze", methods=["POST"])
def analyze_video_only():
    try:
        init_engines()
        data = request.json or {}
        # Node.js에서 'frame' 혹은 'image' 키로 오는 데이터를 모두 허용
        frame = data.get("frame") or data.get("image") 
        
        if frame is None:
            return jsonify({"success": False, "error": "no image data provided"}), 400

        video = EngineManager.video
        video.add_video_frame(frame)
        result = safe_engine_call(video.analyze)

        return jsonify({
            "success": True,
            "camera_id": data.get("camera_id"),
            "result": result
        })
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

# 3. NODE.JS REALTIME AUDIO API - [수정됨: /api 추가]
@app.route("/api/audio/analyze", methods=["POST"])
def analyze_audio_only():
    try:
        init_engines()
        data = request.json or {}
        audio_data = data.get("audio")
        
        if audio_data is None:
            return jsonify({"success": False, "error": "no audio data provided"}), 400

        audio = EngineManager.audio
        audio.add_audio_frame(audio_data)
        result = safe_engine_call(audio.analyze)

        return jsonify({
            "success": True,
            "device_id": data.get("device_id"),
            "result": result
        })
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

def create_app():
    init_engines()
    return app

if __name__ == "__main__":
    init_engines()
    app.run(
        host=config.FLASK_HOST, 
        port=config.FLASK_PORT, 
        debug=config.DEBUG,
        use_reloader=False, 
        threaded=True
    )