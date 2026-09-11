from rest_framework import status
from rest_framework.exceptions import APIException

from apps.core.responses import api_error


class TikitakaException(APIException):
    def __init__(self, message, status_code=status.HTTP_400_BAD_REQUEST, code="ERROR", field_errors=None):
        self.message = message
        self.status_code = status_code
        self.code = code
        self.field_errors = field_errors
        super().__init__(detail=message)


def tikitaka_exception_handler(exc, context):
    if isinstance(exc, TikitakaException):
        return api_error(exc.code, exc.message, exc.status_code, exc.field_errors)

    from rest_framework.views import exception_handler

    response = exception_handler(exc, context)
    if response is not None:
        code = "VALIDATION_ERROR"
        message = str(exc.detail) if hasattr(exc, "detail") else str(exc)
        field_errors = None
        if hasattr(exc, "detail") and isinstance(exc.detail, dict):
            field_errors = {k: str(v[0]) if isinstance(v, list) else str(v) for k, v in exc.detail.items()}
            message = "; ".join(field_errors.values())
        return api_error(code, message, response.status_code, field_errors)

    return None
