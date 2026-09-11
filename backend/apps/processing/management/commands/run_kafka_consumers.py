import json
import logging

from confluent_kafka import Consumer
from django.conf import settings
from django.core.management.base import BaseCommand

from apps.analytics.pipeline import process_normalized_match_in_process
from apps.processing.pipeline import normalize_and_persist

logger = logging.getLogger(__name__)


class Command(BaseCommand):
    help = "Run Kafka consumers for raw and normalized match events"

    def handle(self, *args, **options):
        if not settings.KAFKA_ENABLED:
            self.stdout.write("KAFKA_ENABLED is false; consumers not started.")
            return

        import threading

        raw_thread = threading.Thread(target=self._consume_raw, daemon=True)
        norm_thread = threading.Thread(target=self._consume_normalized, daemon=True)
        raw_thread.start()
        norm_thread.start()
        self.stdout.write("Kafka consumers started. Press Ctrl+C to stop.")
        raw_thread.join()

    def _consume_raw(self):
        consumer = Consumer({
            "bootstrap.servers": settings.KAFKA_BOOTSTRAP_SERVERS,
            "group.id": "tikitaka-processing",
            "auto.offset.reset": "earliest",
        })
        consumer.subscribe(["raw-match-events"])
        while True:
            msg = consumer.poll(1.0)
            if msg is None or msg.error():
                continue
            try:
                data = json.loads(msg.value().decode("utf-8"))
                normalize_and_persist(data)
            except Exception as exc:
                logger.exception("Failed to process raw match: %s", exc)

    def _consume_normalized(self):
        consumer = Consumer({
            "bootstrap.servers": settings.KAFKA_BOOTSTRAP_SERVERS,
            "group.id": "tikitaka-analytics",
            "auto.offset.reset": "earliest",
        })
        consumer.subscribe(["normalized-match-events"])
        while True:
            msg = consumer.poll(1.0)
            if msg is None or msg.error():
                continue
            try:
                data = json.loads(msg.value().decode("utf-8"))
                process_normalized_match_in_process(data)
            except Exception as exc:
                logger.exception("Failed to process normalized match: %s", exc)
