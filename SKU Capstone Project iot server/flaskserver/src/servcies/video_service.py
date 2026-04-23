import base64
import cv2
import numpy as np
# [수정] 폴더 구조에 맞춘 상대 경로 임포트
from ..engines.video_engine import VideoEngine
from ..utils import validate_frame, wrap_node_response, log_debug

# 서버 실행 시 엔진 인스턴스 생성
engine = VideoEngine()

def process_video(data):
    try:
        # =========================
        # 1. 입력 정리
        # =========================
        # Node.js에서 'frame' 혹은 'image'라는 키로 데이터를 보낼 수 있으므로 둘 다 체크
        frame_data = data.get("frame") or data.get("image")
        camera_id = data.get("camera_id", "default_cam")

        if not validate_frame(frame_data):
            return wrap_node_response(
                success=False,
                error="invalid frame data"
            )

        log_debug("VIDEO_SERVICE", f"Processing camera={camera_id}")

        # ==========================================
        # 2. Base64 디코딩 (엔진에 넣기 위해 이미지로 변환)
        # ==========================================
        try:
            # Base64 문자열을 이미지 배열(numpy)로 변환
            img_bytes = base64.b64decode(frame_data)
            nparr = np.frombuffer(img_bytes, np.uint8)
            img_frame = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
            
            if img_frame is None:
                raise ValueError("Decode failed")
        except Exception as e:
            return wrap_node_response(success=False, error=f"Image decoding failed: {e}")

        # =========================
        # 3. engine 호출
        # =========================
        engine.add_video_frame(img_frame)
        result = engine.analyze()

        # =========================
        # 4. 결과 없음 처리 (버퍼링 중 등)
        # =========================
        if result is None or result.get("status") == "buffering":
            return wrap_node_response(
                success=True,
                data={
                    "camera_id": camera_id,
                    "status": "buffering",
                    "current_buffer": result.get("current_size", 0) if result else 0
                }
            )

        # =========================
        # 5. 안전 confidence 처리 (민성님 기존 로직 유지)
        # =========================
        confidence = result.get("confidence", 0.0)

        if confidence < 0.7:
            return wrap_node_response(
                success=True,
                data={
                    "camera_id": camera_id,
                    "result": result,
                    "status": "low_confidence"
                }
            )

        # =========================
        # 6. 정상 응답
        # =========================
        return wrap_node_response(
            success=True,
            data={
                "camera_id": camera_id,
                "result": result,
                "status": "ok"
            }
        )

    except Exception as e:
        log_debug("VIDEO_SERVICE_ERROR", str(e))
        return wrap_node_response(
            success=False,
            error=str(e)
        )