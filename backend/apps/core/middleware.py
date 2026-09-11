from django.conf import settings
from django.middleware.csrf import CsrfViewMiddleware
from django.utils.deprecation import MiddlewareMixin

from apps.accounts.models import User
from apps.core.jwt_service import decode_token
from apps.core.responses import api_error


class SpaCsrfMiddleware(CsrfViewMiddleware):
    """CSRF middleware with SPA-friendly exemptions matching Spring Security."""

    def _should_exempt(self, request):
        path = request.path
        if path.startswith("/api/v1/auth/oauth/"):
            return True
        for exempt in settings.CSRF_EXEMPT_PATHS:
            if path == exempt or path.startswith(exempt):
                return True
        return False

    def process_view(self, request, callback, callback_args, callback_kwargs):
        if self._should_exempt(request):
            return None
        return super().process_view(request, callback, callback_args, callback_kwargs)


class JwtAuthenticationMiddleware(MiddlewareMixin):
    """Attach authenticated user from Bearer JWT token."""

    PUBLIC_PREFIXES = (
        "/api/v1/auth/register",
        "/api/v1/auth/login",
        "/api/v1/auth/forgot-password",
        "/api/v1/auth/reset-password",
        "/api/v1/auth/csrf",
        "/api/v1/auth/oauth/",
        "/api/v1/games",
        "/api/v1/patterns",
        "/actuator/",
        "/admin/",
    )

    def process_request(self, request):
        request.tikitaka_user = None
        if request.method == "OPTIONS":
            return None

        path = request.path
        if any(path.startswith(p) for p in self.PUBLIC_PREFIXES):
            auth_header = request.META.get("HTTP_AUTHORIZATION", "")
            if auth_header.startswith("Bearer "):
                self._authenticate(request, auth_header[7:])
            return None

        auth_header = request.META.get("HTTP_AUTHORIZATION", "")
        if not auth_header.startswith("Bearer "):
            return api_error("UNAUTHORIZED", "Authentication is required", 401)

        return self._authenticate(request, auth_header[7:])

    def _authenticate(self, request, token):
        try:
            payload = decode_token(token)
            email = payload.get("sub")
            user = User.objects.filter(email=email).first()
            if user is None:
                return api_error("UNAUTHORIZED", "Authentication is required", 401)
            request.tikitaka_user = user
            request.user = user
            return None
        except Exception:
            if any(request.path.startswith(p) for p in self.PUBLIC_PREFIXES):
                return None
            return api_error("UNAUTHORIZED", "Authentication is required", 401)
