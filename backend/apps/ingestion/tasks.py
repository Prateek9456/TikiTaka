from celery import shared_task

from apps.ingestion.services import poll_user_matches, run_scheduled_ingestion, sync_user_matches


@shared_task
def scheduled_ingestion_task():
    run_scheduled_ingestion()


@shared_task
def user_match_poller_task():
    poll_user_matches()


@shared_task
def sync_user_matches_task(user_id, game_id=None, limit=5):
    return sync_user_matches(user_id, game_id, limit)
