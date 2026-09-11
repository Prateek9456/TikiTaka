import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):
    initial = True

    dependencies = [
        ("games", "0001_initial"),
        ("accounts", "0002_usergameaccount"),
    ]

    operations = [
        migrations.CreateModel(
            name="Match",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("external_match_id", models.CharField(max_length=128)),
                ("played_at", models.DateTimeField()),
                ("duration_seconds", models.IntegerField(blank=True, null=True)),
                ("patch_version", models.CharField(blank=True, max_length=32, null=True)),
                ("raw_data", models.JSONField(blank=True, null=True)),
                ("game", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="matches", to="games.game")),
            ],
            options={"db_table": "matches"},
        ),
        migrations.AddConstraint(
            model_name="match",
            constraint=models.UniqueConstraint(fields=("game", "external_match_id"), name="idx_matches_external_id"),
        ),
        migrations.CreateModel(
            name="MatchEvent",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("event_type", models.CharField(max_length=64)),
                ("timestamp_ms", models.BigIntegerField()),
                ("actor_id", models.CharField(blank=True, max_length=128, null=True)),
                ("target_id", models.CharField(blank=True, max_length=128, null=True)),
                ("metadata", models.JSONField(blank=True, null=True)),
                ("match", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="events", to="matches.match")),
            ],
            options={"db_table": "match_events"},
        ),
        migrations.CreateModel(
            name="MatchParticipant",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("side", models.CharField(blank=True, max_length=16, null=True)),
                ("result", models.CharField(default="UNKNOWN", max_length=16)),
                ("match", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="participants", to="matches.match")),
                ("player", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="match_participations", to="games.player")),
                ("team", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, to="games.team")),
            ],
            options={"db_table": "match_participants"},
        ),
        migrations.CreateModel(
            name="MatchPatternOccurrence",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("timestamp_ms", models.BigIntegerField()),
                ("confidence_score", models.DecimalField(decimal_places=4, max_digits=5)),
                ("match", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="pattern_occurrences", to="matches.match")),
                ("pattern", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, to="games.tacticalpattern")),
                ("team", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, to="games.team")),
            ],
            options={"db_table": "match_pattern_occurrences"},
        ),
        migrations.CreateModel(
            name="PlayerPerformanceScore",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("score", models.DecimalField(decimal_places=4, max_digits=8)),
                ("computed_at", models.DateTimeField()),
                ("match", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="performance_scores", to="matches.match")),
                ("pattern", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, to="games.tacticalpattern")),
                ("player", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="performance_scores", to="games.player")),
            ],
            options={"db_table": "player_performance_scores"},
        ),
        migrations.CreateModel(
            name="UserMatch",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("source", models.CharField(max_length=32)),
                ("ingested_at", models.DateTimeField()),
                ("game", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, to="games.game")),
                ("match", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="user_ownerships", to="matches.match")),
                ("user", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="user_matches", to="accounts.user")),
            ],
            options={"db_table": "user_matches"},
        ),
    ]
