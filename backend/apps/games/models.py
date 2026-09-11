from django.db import models


class Game(models.Model):
    name = models.CharField(max_length=100)
    slug = models.CharField(max_length=50, unique=True)
    api_source = models.CharField(max_length=100)
    is_active = models.BooleanField(default=True)

    class Meta:
        db_table = "games"

    def __str__(self):
        return self.name


class Player(models.Model):
    game = models.ForeignKey(Game, on_delete=models.CASCADE, related_name="players")
    external_player_id = models.CharField(max_length=128)
    username = models.CharField(max_length=128)
    region = models.CharField(max_length=32, null=True, blank=True)
    metadata = models.JSONField(null=True, blank=True)

    class Meta:
        db_table = "players"
        constraints = [
            models.UniqueConstraint(fields=["game", "external_player_id"], name="idx_players_external_id"),
        ]


class Team(models.Model):
    game = models.ForeignKey(Game, on_delete=models.CASCADE, related_name="teams")
    external_team_id = models.CharField(max_length=128)
    name = models.CharField(max_length=128)
    region = models.CharField(max_length=32, null=True, blank=True)

    class Meta:
        db_table = "teams"
        constraints = [
            models.UniqueConstraint(fields=["game", "external_team_id"], name="idx_teams_external_id"),
        ]


class TeamPlayer(models.Model):
    team = models.ForeignKey(Team, on_delete=models.CASCADE, related_name="team_players")
    player = models.ForeignKey(Player, on_delete=models.CASCADE, related_name="team_memberships")
    role = models.CharField(max_length=64, null=True, blank=True)
    joined_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = "team_players"
        constraints = [
            models.UniqueConstraint(fields=["team", "player"], name="idx_team_players_unique"),
        ]


class TacticalPattern(models.Model):
    game = models.ForeignKey(Game, on_delete=models.CASCADE, related_name="patterns")
    pattern_name = models.CharField(max_length=128)
    pattern_slug = models.CharField(max_length=64)
    description = models.TextField(null=True, blank=True)
    event_sequence = models.JSONField(null=True, blank=True)
    win_rate = models.DecimalField(max_digits=5, decimal_places=4, null=True, blank=True)
    sample_size = models.IntegerField(default=0)

    class Meta:
        db_table = "tactical_patterns"
        constraints = [
            models.UniqueConstraint(fields=["game", "pattern_slug"], name="idx_tactical_patterns_slug"),
        ]


class GameSession(models.Model):
    user = models.ForeignKey("accounts.User", on_delete=models.CASCADE, related_name="game_sessions")
    game = models.ForeignKey(Game, on_delete=models.CASCADE, related_name="game_sessions")
    started_at = models.DateTimeField()
    ended_at = models.DateTimeField()
    match_count = models.IntegerField(default=1)
    source = models.CharField(max_length=16, default="INFERRED")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "game_sessions"


class ApiFetchLog(models.Model):
    game = models.ForeignKey(Game, on_delete=models.CASCADE, related_name="fetch_logs")
    fetch_type = models.CharField(max_length=64)
    status = models.CharField(max_length=16)
    records_fetched = models.IntegerField(default=0)
    fetched_at = models.DateTimeField()
    metadata = models.JSONField(null=True, blank=True)

    class Meta:
        db_table = "api_fetch_logs"
