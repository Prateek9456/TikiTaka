from datetime import datetime, timezone

from rest_framework.response import Response


def api_success(data=None, message=None, status=200):
    payload = {
        "success": True,
        "timestamp": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
    }
    if message is not None:
        payload["message"] = message
    if data is not None:
        payload["data"] = data
    else:
        payload["data"] = None
    return Response(payload, status=status)


def api_error(code, message, status=400, field_errors=None):
    error = {"code": code, "message": message}
    if field_errors:
        error["fieldErrors"] = field_errors
    return Response(
        {
            "success": False,
            "error": error,
            "timestamp": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
        },
        status=status,
    )
