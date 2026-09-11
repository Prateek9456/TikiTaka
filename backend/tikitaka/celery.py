import os

from celery import Celery

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "tikitaka.settings")

app = Celery("tikitaka")
app.config_from_object("django.conf:settings", namespace="CELERY")
app.autodiscover_tasks()
