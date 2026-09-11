from celery import shared_task

from apps.ingestion.services import poll_user_matches, run_scheduled_ingestion


@shared_task
def scheduled_ingestion_task():
    run_scheduled_ingestion()


@shared_task
def user_match_poller_task():
    poll_user_matches()
