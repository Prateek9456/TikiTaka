import django.db.models.deletion
from django.db import migrations, models


def seed_games(apps, schema_editor):
    Game = apps.get_model("games", "Game")
    games = [
        (1, "Dota 2", "dota2", "OpenDota", True),
        (2, "Counter-Strike 2", "cs2", "Faceit Open API", True),
        (3, "Valorant", "valorant", "Riot Games", True),
        (4, "League of Legends", "lol", "Riot Games", True),
    ]
    for gid, name, slug, api_source, is_active in games:
        Game.objects.update_or_create(
            id=gid,
            defaults={"name": name, "slug": slug, "api_source": api_source, "is_active": is_active},
        )


class Migration(migrations.Migration):
    initial = True

    dependencies = [
        ("accounts", "0001_initial"),
    ]

    operations = [
        migrations.CreateModel(
            name="Game",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("name", models.CharField(max_length=100)),
                ("slug", models.CharField(max_length=50, unique=True)),
                ("api_source", models.CharField(max_length=100)),
                ("is_active", models.BooleanField(default=True)),
            ],
            options={"db_table": "games"},
        ),
        migrations.CreateModel(
            name="TacticalPattern",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("pattern_name", models.CharField(max_length=128)),
                ("pattern_slug", models.CharField(max_length=64)),
                ("description", models.TextField(blank=True, null=True)),
                ("event_sequence", models.JSONField(blank=True, null=True)),
                ("win_rate", models.DecimalField(blank=True, decimal_places=4, max_digits=5, null=True)),
                ("sample_size", models.IntegerField(default=0)),
                ("game", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="patterns", to="games.game")),
            ],
            options={"db_table": "tactical_patterns"},
        ),
        migrations.AddConstraint(
            model_name="tacticalpattern",
            constraint=models.UniqueConstraint(fields=("game", "pattern_slug"), name="idx_tactical_patterns_slug"),
        ),
        migrations.CreateModel(
            name="Team",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("external_team_id", models.CharField(max_length=128)),
                ("name", models.CharField(max_length=128)),
                ("region", models.CharField(blank=True, max_length=32, null=True)),
                ("game", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="teams", to="games.game")),
            ],
            options={"db_table": "teams"},
        ),
        migrations.AddConstraint(
            model_name="team",
            constraint=models.UniqueConstraint(fields=("game", "external_team_id"), name="idx_teams_external_id"),
        ),
        migrations.CreateModel(
            name="Player",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("external_player_id", models.CharField(max_length=128)),
                ("username", models.CharField(max_length=128)),
                ("region", models.CharField(blank=True, max_length=32, null=True)),
                ("metadata", models.JSONField(blank=True, null=True)),
                ("game", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="players", to="games.game")),
            ],
            options={"db_table": "players"},
        ),
        migrations.AddConstraint(
            model_name="player",
            constraint=models.UniqueConstraint(fields=("game", "external_player_id"), name="idx_players_external_id"),
        ),
        migrations.CreateModel(
            name="TeamPlayer",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("role", models.CharField(blank=True, max_length=64, null=True)),
                ("joined_at", models.DateTimeField(blank=True, null=True)),
                ("player", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="team_memberships", to="games.player")),
                ("team", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="team_players", to="games.team")),
            ],
            options={"db_table": "team_players"},
        ),
        migrations.AddConstraint(
            model_name="teamplayer",
            constraint=models.UniqueConstraint(fields=("team", "player"), name="idx_team_players_unique"),
        ),
        migrations.CreateModel(
            name="ApiFetchLog",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("fetch_type", models.CharField(max_length=64)),
                ("status", models.CharField(max_length=16)),
                ("records_fetched", models.IntegerField(default=0)),
                ("fetched_at", models.DateTimeField()),
                ("metadata", models.JSONField(blank=True, null=True)),
                ("game", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="fetch_logs", to="games.game")),
            ],
            options={"db_table": "api_fetch_logs"},
        ),
        migrations.CreateModel(
            name="GameSession",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("started_at", models.DateTimeField()),
                ("ended_at", models.DateTimeField()),
                ("match_count", models.IntegerField(default=1)),
                ("source", models.CharField(default="INFERRED", max_length=16)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("game", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="game_sessions", to="games.game")),
                ("user", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="game_sessions", to="accounts.user")),
            ],
            options={"db_table": "game_sessions"},
        ),
        migrations.RunPython(seed_games, migrations.RunPython.noop),
    ]
