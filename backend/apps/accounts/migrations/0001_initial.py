import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):
    initial = True

    dependencies = []

    operations = [
        migrations.CreateModel(
            name="User",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("last_login", models.DateTimeField(blank=True, null=True, verbose_name="last login")),
                ("is_superuser", models.BooleanField(default=False)),
                ("email", models.EmailField(max_length=255, unique=True)),
                ("username", models.CharField(max_length=32, unique=True)),
                ("password_hash", models.CharField(blank=True, db_column="password_hash", max_length=255, null=True)),
                ("display_name", models.CharField(blank=True, max_length=255, null=True)),
                ("avatar_url", models.CharField(blank=True, max_length=512, null=True)),
                ("date_of_birth", models.DateField(blank=True, null=True)),
                ("location", models.CharField(blank=True, max_length=255, null=True)),
                ("last_login_at", models.DateTimeField(blank=True, null=True)),
                ("last_login_ip", models.CharField(blank=True, max_length=45, null=True)),
                ("role", models.CharField(choices=[("ADMIN", "Admin"), ("ANALYST", "Analyst"), ("VIEWER", "Viewer")], default="VIEWER", max_length=16)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("is_staff", models.BooleanField(default=False)),
                ("is_active", models.BooleanField(default=True)),
                ("groups", models.ManyToManyField(blank=True, related_name="user_set", related_query_name="user", to="auth.group")),
                ("user_permissions", models.ManyToManyField(blank=True, related_name="user_set", related_query_name="user", to="auth.permission")),
            ],
            options={"db_table": "users"},
        ),
        migrations.CreateModel(
            name="LinkedAccount",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("provider", models.CharField(choices=[("GOOGLE", "Google"), ("RIOT", "Riot"), ("STEAM", "Steam"), ("FACEIT", "Faceit"), ("EPIC", "Epic")], max_length=16)),
                ("provider_user_id", models.CharField(max_length=255)),
                ("email", models.CharField(blank=True, max_length=255, null=True)),
                ("display_name", models.CharField(blank=True, max_length=255, null=True)),
                ("avatar_url", models.CharField(blank=True, max_length=512, null=True)),
                ("access_token", models.TextField(blank=True, null=True)),
                ("refresh_token", models.TextField(blank=True, null=True)),
                ("token_expires_at", models.DateTimeField(blank=True, null=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("user", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="linked_accounts", to="accounts.user")),
            ],
            options={"db_table": "linked_accounts"},
        ),
        migrations.AddConstraint(
            model_name="linkedaccount",
            constraint=models.UniqueConstraint(fields=("provider", "provider_user_id"), name="uk_linked_accounts_provider_user"),
        ),
        migrations.AddConstraint(
            model_name="linkedaccount",
            constraint=models.UniqueConstraint(fields=("user", "provider"), name="uk_linked_accounts_user_provider"),
        ),
        migrations.CreateModel(
            name="PasswordResetOtp",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("email", models.CharField(max_length=255)),
                ("otp_hash", models.CharField(max_length=255)),
                ("expires_at", models.DateTimeField()),
                ("consumed_at", models.DateTimeField(blank=True, null=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("user", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="password_reset_otps", to="accounts.user")),
            ],
            options={"db_table": "password_reset_otps"},
        ),
        migrations.CreateModel(
            name="AuthSession",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("provider", models.CharField(blank=True, max_length=16, null=True)),
                ("login_at", models.DateTimeField()),
                ("logout_at", models.DateTimeField(blank=True, null=True)),
                ("ip_address", models.CharField(blank=True, max_length=45, null=True)),
                ("user_agent", models.CharField(blank=True, max_length=512, null=True)),
                ("location", models.CharField(blank=True, max_length=255, null=True)),
                ("user", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="auth_sessions", to="accounts.user")),
            ],
            options={"db_table": "auth_sessions"},
        ),
    ]
