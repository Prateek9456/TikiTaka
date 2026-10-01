from django.conf import settings
from django.core.management.base import BaseCommand
from django_celery_beat.models import CrontabSchedule, PeriodicTask


def _parse_cron(expression: str) -> dict:
    parts = expression.split()
    if len(parts) == 6:
        _, minute, hour, day_of_month, month_of_year, day_of_week = parts
    elif len(parts) == 5:
        minute, hour, day_of_month, month_of_year, day_of_week = parts
    else:
        raise ValueError(f"Unsupported cron expression: {expression}")
    return {
        "minute": minute,
        "hour": hour,
        "day_of_month": day_of_month,
        "month_of_year": month_of_year,
        "day_of_week": day_of_week,
    }


def _ensure_periodic_task(name, task, cron_expression):
    fields = _parse_cron(cron_expression)
    schedule, _ = CrontabSchedule.objects.get_or_create(
        minute=fields["minute"],
        hour=fields["hour"],
        day_of_month=fields["day_of_month"],
        month_of_year=fields["month_of_year"],
        day_of_week=fields["day_of_week"],
        timezone=settings.CELERY_TIMEZONE,
    )
    PeriodicTask.objects.update_or_create(
        name=name,
        defaults={
            "task": task,
            "crontab": schedule,
            "enabled": True,
        },
    )


class Command(BaseCommand):
    help = "Register Celery Beat periodic tasks for match ingestion and user polling"

    def handle(self, *args, **options):
        _ensure_periodic_task(
            "tikitaka-scheduled-ingestion",
            "apps.ingestion.tasks.scheduled_ingestion_task",
            settings.TIKITAKA_INGESTION_CRON,
        )
        _ensure_periodic_task(
            "tikitaka-user-match-poller",
            "apps.ingestion.tasks.user_match_poller_task",
            settings.TIKITAKA_USER_POLLER_CRON,
        )
        self.stdout.write(self.style.SUCCESS("Ingestion beat schedule updated"))
