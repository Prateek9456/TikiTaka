from django.db import models


class Match(models.Model):
    game = models.ForeignKey("games.Game", on_delete=models.CASCADE, related_name="matches")
    external_match_id = models.CharField(max_length=128)
    played_at = models.DateTimeField()
    duration_seconds = models.IntegerField(null=True, blank=True)
    patch_version = models.CharField(max_length=32, null=True, blank=True)
    raw_data = models.JSONField(null=True, blank=True)

    class Meta:
        db_table = "matches"
        constraints = [
            models.UniqueConstraint(fields=["game", "external_match_id"], name="idx_matches_external_id"),
        ]


class MatchParticipant(models.Model):
    match = models.ForeignKey(Match, on_delete=models.CASCADE, related_name="participants")
    player = models.ForeignKey("games.Player", on_delete=models.CASCADE, related_name="match_participations")
    team = models.ForeignKey("games.Team", on_delete=models.SET_NULL, null=True, blank=True)
    side = models.CharField(max_length=16, null=True, blank=True)
    result = models.CharField(max_length=16, default="UNKNOWN")

    class Meta:
        db_table = "match_participants"


class MatchEvent(models.Model):
    match = models.ForeignKey(Match, on_delete=models.CASCADE, related_name="events")
    event_type = models.CharField(max_length=64)
    timestamp_ms = models.BigIntegerField()
    actor_id = models.CharField(max_length=128, null=True, blank=True)
    target_id = models.CharField(max_length=128, null=True, blank=True)
    metadata = models.JSONField(null=True, blank=True)

    class Meta:
        db_table = "match_events"


class MatchPatternOccurrence(models.Model):
    match = models.ForeignKey(Match, on_delete=models.CASCADE, related_name="pattern_occurrences")
    pattern = models.ForeignKey("games.TacticalPattern", on_delete=models.CASCADE)
    team = models.ForeignKey("games.Team", on_delete=models.SET_NULL, null=True, blank=True)
    timestamp_ms = models.BigIntegerField()
    confidence_score = models.DecimalField(max_digits=5, decimal_places=4)

    class Meta:
        db_table = "match_pattern_occurrences"


class PlayerPerformanceScore(models.Model):
    player = models.ForeignKey("games.Player", on_delete=models.CASCADE, related_name="performance_scores")
    match = models.ForeignKey(Match, on_delete=models.CASCADE, related_name="performance_scores")
    pattern = models.ForeignKey("games.TacticalPattern", on_delete=models.SET_NULL, null=True, blank=True)
    score = models.DecimalField(max_digits=8, decimal_places=4)
    computed_at = models.DateTimeField()

    class Meta:
        db_table = "player_performance_scores"


class UserMatch(models.Model):
    user = models.ForeignKey("accounts.User", on_delete=models.CASCADE, related_name="user_matches")
    match = models.ForeignKey(Match, on_delete=models.CASCADE, related_name="user_ownerships")
    game = models.ForeignKey("games.Game", on_delete=models.CASCADE)
    source = models.CharField(max_length=32)
    ingested_at = models.DateTimeField()

    class Meta:
        db_table = "user_matches"
