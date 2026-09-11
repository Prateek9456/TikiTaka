from django.contrib.auth.models import AbstractBaseUser, BaseUserManager, PermissionsMixin
from django.db import models


class UserRole(models.TextChoices):
    ADMIN = "ADMIN", "Admin"
    ANALYST = "ANALYST", "Analyst"
    VIEWER = "VIEWER", "Viewer"


class OAuthProvider(models.TextChoices):
    GOOGLE = "GOOGLE", "Google"
    RIOT = "RIOT", "Riot"
    STEAM = "STEAM", "Steam"
    FACEIT = "FACEIT", "Faceit"
    EPIC = "EPIC", "Epic"


class UserManager(BaseUserManager):
    def create_user(self, email, password=None, **extra_fields):
        if not email:
            raise ValueError("Email is required")
        email = self.normalize_email(email)
        user = self.model(email=email, **extra_fields)
        if password:
            user.set_password(password)
        user.save(using=self._db)
        return user


class User(AbstractBaseUser, PermissionsMixin):
    email = models.EmailField(max_length=255, unique=True)
    username = models.CharField(max_length=32, unique=True)
    password_hash = models.CharField(max_length=255, null=True, blank=True, db_column="password_hash")
    display_name = models.CharField(max_length=255, null=True, blank=True)
    avatar_url = models.CharField(max_length=512, null=True, blank=True)
    date_of_birth = models.DateField(null=True, blank=True)
    location = models.CharField(max_length=255, null=True, blank=True)
    last_login_at = models.DateTimeField(null=True, blank=True)
    last_login_ip = models.CharField(max_length=45, null=True, blank=True)
    role = models.CharField(max_length=16, choices=UserRole.choices, default=UserRole.VIEWER)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    is_staff = models.BooleanField(default=False)
    is_active = models.BooleanField(default=True)

    USERNAME_FIELD = "email"
    REQUIRED_FIELDS = ["username"]

    class Meta:
        db_table = "users"

    @property
    def password(self):
        return self.password_hash

    @password.setter
    def password(self, value):
        self.password_hash = value


class LinkedAccount(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="linked_accounts")
    provider = models.CharField(max_length=16, choices=OAuthProvider.choices)
    provider_user_id = models.CharField(max_length=255)
    email = models.CharField(max_length=255, null=True, blank=True)
    display_name = models.CharField(max_length=255, null=True, blank=True)
    avatar_url = models.CharField(max_length=512, null=True, blank=True)
    access_token = models.TextField(null=True, blank=True)
    refresh_token = models.TextField(null=True, blank=True)
    token_expires_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "linked_accounts"
        constraints = [
            models.UniqueConstraint(fields=["provider", "provider_user_id"], name="uk_linked_accounts_provider_user"),
            models.UniqueConstraint(fields=["user", "provider"], name="uk_linked_accounts_user_provider"),
        ]


class UserGameAccount(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="game_accounts")
    game = models.ForeignKey("games.Game", on_delete=models.CASCADE)
    external_player_id = models.CharField(max_length=128)
    metadata = models.JSONField(null=True, blank=True)
    last_polled_at = models.DateTimeField(null=True, blank=True)
    last_match_external_id = models.CharField(max_length=128, null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "user_game_accounts"
        constraints = [
            models.UniqueConstraint(fields=["user", "game"], name="uk_user_game_accounts_user_game"),
        ]


class AuthSession(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="auth_sessions")
    provider = models.CharField(max_length=16, null=True, blank=True)
    login_at = models.DateTimeField()
    logout_at = models.DateTimeField(null=True, blank=True)
    ip_address = models.CharField(max_length=45, null=True, blank=True)
    user_agent = models.CharField(max_length=512, null=True, blank=True)
    location = models.CharField(max_length=255, null=True, blank=True)

    class Meta:
        db_table = "auth_sessions"


class PasswordResetOtp(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="password_reset_otps")
    email = models.CharField(max_length=255)
    otp_hash = models.CharField(max_length=255)
    expires_at = models.DateTimeField()
    consumed_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "password_reset_otps"
