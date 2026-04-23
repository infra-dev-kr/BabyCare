import numpy as np
import torch
import librosa
import time
from collections import deque
from transformers import Wav2Vec2ForSequenceClassification, Wav2Vec2FeatureExtractor

# config는 프로젝트 루트에 있으므로 run.py 실행 시 참조 가능
try:
    from config import (
        BABY_CRY_MODEL, WINDOW_SIZE, HOP_SIZE, 
        THRESHOLD, TARGET_SR, DEVICE
    )
except ImportError:
    # 테스트 환경을 위한 기본값 세팅 (config 로드 실패 시)
    BABY_CRY_MODEL = "./models/baby_cry_model_v3"
    TARGET_SR = 48000
    THRESHOLD = 0.5
    DEVICE = "cpu"

# 상위 폴더 utils 참조
from ..utils import calculate_db

class AudioEngine:
    def __init__(self):
        self.device = DEVICE if torch.cuda.is_available() else "cpu"

        # 모델 로드
        self.model = Wav2Vec2ForSequenceClassification.from_pretrained(
            str(BABY_CRY_MODEL)
        ).to(self.device)

        self.feature_extractor = Wav2Vec2FeatureExtractor.from_pretrained(
            str(BABY_CRY_MODEL)
        )

        # 1초 분량 버퍼
        self.audio_buffer = deque(maxlen=TARGET_SR)

        self.db_flag = False
        self.cry_flag = False
        self.last_db_time = None
        self.last_cry_time = None

        self.cry_events = []
        self.noise_events = []

        print(f"✅ [AudioEngine] AI 모델 로드 완료 ({self.device})")

    def add_audio_frame(self, audio_data):
        """실시간 오디오 데이터를 버퍼에 추가하고 소음을 체크합니다."""
        try:
            if not isinstance(audio_data, np.ndarray):
                audio_data = np.array(audio_data)

            if audio_data.ndim == 2:
                audio_data = np.mean(audio_data, axis=1 if audio_data.shape[1] == 2 else 0)

            audio_data = audio_data.astype(np.float32)
            self.audio_buffer.extend(audio_data)

            # dB 체크 및 소음 이벤트 등록
            db = calculate_db(audio_data)
            now = time.time()

            if db > -30: 
                if not self.db_flag:
                    self.db_flag = True
                    self.noise_events.append({"start": now, "end": None, "type": "noise"})
                self.last_db_time = now
            
            return db
        except Exception as e:
            print(f"❌ [AudioEngine] 프레임 추가 에러: {e}")
            return None

    def analyze(self):
        """버퍼에 쌓인 데이터를 분석하여 아기 울음 여부를 판별합니다."""
        if len(self.audio_buffer) < TARGET_SR:
            return {"cry_detected": False, "msg": "Buffering..."}

        try:
            audio = np.array(self.audio_buffer)
            audio_16k = librosa.resample(audio, orig_sr=TARGET_SR, target_sr=16000)

            # WINDOW_SIZE와 HOP_SIZE를 이용한 청크 분할 (config 참조)
            # 여기서는 기존 민성님 로직을 그대로 유지합니다.
            inputs = self.feature_extractor(
                audio_16k, # 전체를 하나로 보거나 청크로 나눠 처리
                sampling_rate=16000,
                return_tensors="pt",
                padding=True
            ).to(self.device)

            with torch.no_grad():
                logits = self.model(**inputs).logits
                preds = torch.argmax(logits, dim=-1).cpu().numpy()

            cry_ratio = float(np.mean(preds))
            now = time.time()

            # 울음 감지 플래그 관리
            detected = cry_ratio >= THRESHOLD
            if detected:
                if not self.cry_flag:
                    self.cry_flag = True
                    self.cry_events.append({
                        "start": now, "end": None, "ratio": round(cry_ratio, 2), "type": "cry"
                    })
                self.last_cry_time = now

            # 10초 무음 시 이벤트 종료 처리 (민성님 기존 로직)
            self._check_event_timeout(now)

            return {
                "cry_detected": detected,
                "cry_ratio": cry_ratio,
                "cry_events": self.cry_events[-3:], # 최근 3개만 반환 (최적화)
                "noise_events": self.noise_events[-3:]
            }

        except Exception as e:
            print(f"❌ [AudioEngine] 분석 에러: {e}")
            return {"cry_detected": False, "error": str(e)}

    def _check_event_timeout(self, now):
        """이벤트 종료 여부를 체크합니다."""
        if self.cry_flag and self.last_cry_time and (now - self.last_cry_time > 10):
            self.cry_flag = False
            if self.cry_events: self.cry_events[-1]["end"] = now

        if self.db_flag and self.last_db_time and (now - self.last_db_time > 10):
            self.db_flag = False
            if self.noise_events: self.noise_events[-1]["end"] = now

    def reset(self):
        self.audio_buffer.clear()
        self.cry_events = []
        self.noise_events = []