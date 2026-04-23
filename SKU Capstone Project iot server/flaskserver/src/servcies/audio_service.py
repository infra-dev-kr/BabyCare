# [수정] 폴더 구조에 맞춘 상대 경로 임포트
from ..engines.audio_engine import AudioEngine
from ..utils import validate_audio, wrap_node_response, log_debug

# 서버 실행 시 엔진 인스턴스 생성
engine = AudioEngine()

def process_audio(data):
    try:
        # =========================
        # 1. 입력 정리
        # =========================
        device_id = data.get("device_id", "unknown_device")
        audio = data.get("audio")

        # utils.py에 정의된 오디오 유효성 검사 호출
        if not validate_audio(audio):
            return wrap_node_response(
                success=False,
                error="invalid audio data"
            )

        log_debug("AUDIO_SERVICE", f"Processing for device: {device_id}")

        # =========================
        # 2. engine 호출 (프레임 추가 및 분석)
        # =========================
        # [수정] 기존 process() 대신 엔진의 메서드들을 순차적으로 호출합니다.
        engine.add_audio_frame(audio)
        result = engine.analyze()

        # =========================
        # 3. 분석 결과 없음 처리 (버퍼링 중 등)
        # =========================
        if result is None or result.get("msg") == "Buffering...":
            return wrap_node_response(
                success=True,
                data={
                    "device_id": device_id,
                    "status": "buffering",
                    "msg": "데이터를 더 쌓는 중입니다."
                }
            )

        # =========================
        # 4. 아기 울음 감지 로직 (기존 speech/emotion 대신 적용)
        # =========================
        cry_detected = result.get("cry_detected", False)
        cry_ratio = result.get("cry_ratio", 0.0)

        # 울음이 감지되지 않았을 때
        if not cry_detected:
            return wrap_node_response(
                success=True,
                data={
                    "device_id": device_id,
                    "status": "stable",
                    "cry_detected": False,
                    "cry_ratio": cry_ratio
                }
            )

        # =========================
        # 5. 울음 감지 시 정상 응답
        # =========================
        return wrap_node_response(
            success=True,
            data={
                "device_id": device_id,
                "cry_detected": True,
                "cry_ratio": cry_ratio,
                "cry_events": result.get("cry_events", []),
                "noise_events": result.get("noise_events", []),
                "status": "emergency" # 아기가 울고 있으니 emergency 상태로 전송
            }
        )

    except Exception as e:
        log_debug("AUDIO_SERVICE_ERROR", str(e))
        return wrap_node_response(
            success=False,
            error=str(e)
        )