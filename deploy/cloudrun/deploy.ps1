# Deploy TikiTaka to GCP Cloud Run (API, ML, web + optional ingestion job).
# Prerequisites: gcloud CLI, billing enabled, Artifact Registry + Cloud SQL + Upstash Redis.
# Usage (PowerShell):
#   $env:GCP_PROJECT_ID="your-project"
#   $env:GCP_REGION="us-central1"
#   $env:CLOUD_SQL="project:region:instance"
#   ./deploy/cloudrun/deploy.ps1

param(
    [string]$ProjectId = $env:GCP_PROJECT_ID,
    [string]$Region = $(if ($env:GCP_REGION) { $env:GCP_REGION } else { "us-central1" }),
    [string]$CloudSqlConnection = $env:CLOUD_SQL_CONNECTION_NAME,
    [string]$ArtifactRepo = "tikitaka"
)

$ErrorActionPreference = "Stop"
if (-not $ProjectId) { throw "Set GCP_PROJECT_ID or -ProjectId" }
if (-not $CloudSqlConnection) { throw "Set CLOUD_SQL_CONNECTION_NAME or -CloudSqlConnection" }

$Root = (Resolve-Path (Join-Path $PSScriptRoot "../..")).Path
if (-not (Test-Path "$Root/backend/Dockerfile.cloudrun")) {
    throw "Could not find backend/Dockerfile.cloudrun under $Root"
}

$Registry = "$Region-docker.pkg.dev/$ProjectId/$ArtifactRepo"
$ApiImage = "$Registry/tikitaka-api:latest"
$MlImage = "$Registry/tikitaka-ml:latest"
$WebImage = "$Registry/tikitaka-web:latest"

gcloud config set project $ProjectId
gcloud services enable run.googleapis.com artifactregistry.googleapis.com sqladmin.googleapis.com cloudbuild.googleapis.com

gcloud artifacts repositories describe $ArtifactRepo --location=$Region 2>$null
if ($LASTEXITCODE -ne 0) {
    gcloud artifacts repositories create $ArtifactRepo --repository-format=docker --location=$Region
}

Write-Host "Building and pushing images (Cloud Build)..."
Push-Location "$Root/backend"
gcloud builds submit --tag $ApiImage --dockerfile=Dockerfile.cloudrun .
Pop-Location
Push-Location "$Root/ml-service"
gcloud builds submit --tag $MlImage .
Pop-Location
Push-Location "$Root/frontend"
gcloud builds submit --tag $WebImage --dockerfile=Dockerfile.cloudrun .
Pop-Location

Write-Host "Deploy ML service..."
gcloud run deploy tikitaka-ml `
    --image $MlImage `
    --region $Region `
    --allow-unauthenticated `
    --memory 512Mi `
    --cpu 1 `
    --min-instances 0 `
    --max-instances 2 `
    --port 8080 `
    --set-env-vars "PORT=8080"

$MlUrl = gcloud run services describe tikitaka-ml --region $Region --format="value(status.url)"

Write-Host "Deploy API service..."
gcloud run deploy tikitaka-api `
    --image $ApiImage `
    --region $Region `
    --allow-unauthenticated `
    --memory 1Gi `
    --cpu 1 `
    --min-instances 0 `
    --max-instances 3 `
    --port 8080 `
    --add-cloudsql-instances $CloudSqlConnection `
    --set-env-vars "CLOUD_RUN=true,KAFKA_ENABLED=false,RUN_CELERY=false,USE_CELERY_TASKS=false,CLOUD_SQL_CONNECTION_NAME=$CloudSqlConnection,ML_SERVICE_URL=$MlUrl,GUNICORN_WORKERS=1,COOKIE_SECURE=true"

$ApiHost = ([uri](gcloud run services describe tikitaka-api --region $Region --format="value(status.url)")).Host

gcloud run services update tikitaka-api --region $Region `
    --update-env-vars "ALLOWED_HOSTS=$ApiHost"

Write-Host "Deploy web (frontend) service..."
gcloud run deploy tikitaka-web `
    --image $WebImage `
    --region $Region `
    --allow-unauthenticated `
    --memory 256Mi `
    --cpu 1 `
    --min-instances 0 `
    --max-instances 3 `
    --port 8080 `
    --set-env-vars "BACKEND_HOST=$ApiHost,PORT=8080"

$WebUrl = gcloud run services describe tikitaka-web --region $Region --format="value(status.url)"

Write-Host ""
Write-Host "Deployed. Set secrets and URLs in Console -> Cloud Run -> tikitaka-api -> Variables:"
Write-Host "  PUBLIC_APP_URL=$WebUrl"
Write-Host "  CORS_ALLOWED_ORIGINS=$WebUrl"
Write-Host "  MYSQL_* , REDIS_URL , JWT_SECRET , OAuth keys (see deploy/cloudrun/env.example)"
Write-Host ""
Write-Host "Optional ingestion job:"
Write-Host "  gcloud run jobs create tikitaka-ingestion --image $ApiImage --region $Region --command /entrypoint.job.sh --set-env-vars INGESTION_JOB=scheduled,CLOUD_SQL_CONNECTION_NAME=$CloudSqlConnection --add-cloudsql-instances $CloudSqlConnection"
