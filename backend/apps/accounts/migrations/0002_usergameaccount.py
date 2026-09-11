import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("accounts", "0001_initial"),
        ("games", "0001_initial"),
    ]

    operations = [
        migrations.CreateModel(
            name="UserGameAccount",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("external_player_id", models.CharField(max_length=128)),
                ("metadata", models.JSONField(blank=True, null=True)),
                ("last_polled_at", models.DateTimeField(blank=True, null=True)),
                ("last_match_external_id", models.CharField(blank=True, max_length=128, null=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("game", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, to="games.game")),
                ("user", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="game_accounts", to="accounts.user")),
            ],
            options={"db_table": "user_game_accounts"},
        ),
        migrations.AddConstraint(
            model_name="usergameaccount",
            constraint=models.UniqueConstraint(fields=("user", "game"), name="uk_user_game_accounts_user_game"),
        ),
    ]
