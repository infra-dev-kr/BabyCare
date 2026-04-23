import os
import numpy as np
from collections import deque, Counter
import torch

try:
    from ultralytics import YOLO
except ImportError:
    YOLO = None

# 상위 폴더의 config 참조를 위해 수정
try:
    import config
except ImportError:
    # 기본값 설정
    class DummyConfig:
        YOLO_MODEL = "models/yolov8n.pt"
        YOLO_OK = True
        VIDEO_BUFFER_SIZE = 5
        CONFIDENCE_THRESHOLD = 0.5
    config = DummyConfig()

class VideoEngine:
    def __init__(self):
        self.model = None
        model_path = str(config.YOLO_MODEL)

        # YOLO 모델 로드
        if YOLO is not None and getattr(config, 'YOLO_OK', True) and os.path.exists(model_path):
            try:
                self.model = YOLO(model_path)
                print(f"✅ [VideoEngine] YOLO 모델 로드 완료: {model_path}")
            except Exception as e:
                print(f"❌ [VideoEngine] YOLO 로드 실패: {e}")
        else:
            print("⚠️ [VideoEngine] YOLO 모델을 찾을 수 없거나 비활성화되었습니다.")

        self.buffer = deque(maxlen=config.VIDEO_BUFFER_SIZE)
        self.result = None

    def add_video_frame(self, frame):
        """프레임을 버퍼에 추가합니다."""
        if frame is not None:
            self.buffer.append(frame)

    def analyze(self):
        """버퍼링된 프레임을 분석하여 다수결로 결과를 반환합니다."""
        if self.model is None:
            return {"infant_detected": False, "age_label": "no_yolo", "confidence": 0.0}

        if len(self.buffer) < config.VIDEO_BUFFER_SIZE:
            return {"status": "buffering", "current_size": len(self.buffer)}

        face_votes = []
        for frame in list(self.buffer):
            try:
                # 1차 검출
                results = self.model(frame, verbose=False, conf=0.5)
                boxes = results[0].boxes
                if not boxes: continue

                for b in boxes:
                    cls = int(b.cls[0])
                    if cls != 0: continue # 영유아 클래스가 아닐 경우 패스

                    x1, y1, x2, y2 = map(int, b.xyxy[0])
                    if x2 <= x1 or y2 <= y1: continue

                    # 2차 정밀 검출 (Crop)
                    crop = frame[y1:y2, x1:x2]
                    if crop.size == 0: continue
                    
                    res = self.model(crop, verbose=False, conf=0.3)
                    if len(res[0].boxes) > 0:
                        best = max(res[0].boxes, key=lambda x: float(x.conf[0]))
                        face_votes.append(int(best.cls[0]))
            except Exception as e:
                print(f"⚠️ 프레임 분석 중 오류: {e}")
                continue

        if not face_votes:
            return {"infant_detected": False, "age_label": "None", "confidence": 0.0}

        # 다수결 투표
        counter = Counter(face_votes)
        cls, cnt = counter.most_common(1)[0]
        conf = cnt / len(face_votes)

        if conf < config.CONFIDENCE_THRESHOLD:
            return {"infant_detected": False, "age_label": "low_confidence", "confidence": float(conf)}

        label = self.model.names.get(cls, str(cls))

        self.result = {
            "infant_detected": cls == 0,
            "age_label": label,
            "confidence": float(conf)
        }
        return self.result

    def reset(self):
        self.buffer.clear()
        self.result = None