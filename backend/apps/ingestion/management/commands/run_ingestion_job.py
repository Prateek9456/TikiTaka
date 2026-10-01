from django.core.management.base import BaseCommand

from apps.ingestion.services import poll_user_matches, run_scheduled_ingestion


class Command(BaseCommand):
    help = "Run scheduled ingestion or user match poller (for Cloud Run Jobs / cron)"

    def add_arguments(self, parser):
        parser.add_argument(
            "--task",
            choices=("scheduled", "poller"),
            default="scheduled",
            help="scheduled = sync all linked users; poller = check for new matches",
        )

    def handle(self, *args, **options):
        task = options["task"]
        if task == "poller":
            self.stdout.write("Running user match poller...")
            poll_user_matches()
        else:
            self.stdout.write("Running scheduled ingestion...")
            run_scheduled_ingestion()
        self.stdout.write(self.style.SUCCESS(f"Ingestion job finished ({task})"))
