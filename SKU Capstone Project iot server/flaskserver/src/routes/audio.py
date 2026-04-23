from flask import Blueprint, request, jsonify
# [수정] 폴더 구조에 맞춰 경로 변경 (상대 경로 또는 src 경로)
from ..servcies.audio_service import process_audio
from ..utils import log_debug, wrap_node_response

audio_bp = Blueprint("audio", __name__)

@audio_bp.route("/analyze", methods=["POST"]) # url_prefix가 /api/audio이므로 최종 주소는 /api/audio/analyze
def audio_analyze():
    try:
        # 1. request 안전 처리
        data = request.get_json(silent=True)

        if not data:
            return jsonify(
                wrap_node_response(
                    success=False,
                    error="invalid request body"
                )
            ), 400

        log_debug("AUDIO_BP", "request received")

        # 2. service 호출 (엔진을 사용하는 함수)
        result = process_audio(data)

        # 3. 응답 반환
        return jsonify(result)

    except Exception as e:
        log_debug("AUDIO_BP_ERROR", str(e))
        return jsonify(
            wrap_node_response(
                success=False,
                error=str(e)
            )
        ), 500