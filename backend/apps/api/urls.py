from django.urls import path

from apps.api import views

urlpatterns = [
    # Auth
    path("auth/register", views.register),
    path("auth/login", views.login),
    path("auth/csrf", views.csrf_token),
    path("auth/forgot-password", views.forgot_password),
    path("auth/reset-password", views.reset_password_view),
    path("auth/logout", views.logout),
    path("auth/me", views.me),
    path("auth/link/<str:provider>", views.link_provider),
    path("auth/oauth/providers", views.oauth_providers),
    path("auth/oauth/providers/status", views.oauth_provider_status),
    path("auth/oauth/<str:provider>", views.oauth_start),
    path("auth/oauth/<str:provider>/callback", views.oauth_callback),
    # Games & patterns
    path("games", views.games_list),
    path("patterns", views.patterns_list),
    # Leaderboard & matches
    path("leaderboard", views.leaderboard),
    path("matches/latest", views.latest_match),
    path("matches/<int:match_id>/analysis", views.match_analysis),
    # Sessions
    path("sessions/auth", views.auth_sessions),
    path("sessions/game", views.game_sessions),
    # Ingestion
    path("ingest/trigger", views.ingest_trigger),
    path("ingest/trigger/match", views.ingest_trigger_match),
    path("ingest/trigger/<str:game_slug>", views.ingest_trigger_game),
    path("ingest/me/sync", views.ingest_me_sync),
    path("ingest/status", views.ingest_status),
    path("ingest/scheduler", views.ingest_scheduler),
]
