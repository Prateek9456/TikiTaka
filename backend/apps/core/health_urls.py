from django.http import JsonResponse
from django.urls import path


def health(_request):
    return JsonResponse({"status": "UP"})


def info(_request):
    return JsonResponse({"app": "tikitaka-django", "version": "1.0.0"})


urlpatterns = [
    path("health", health),
    path("info", info),
]
