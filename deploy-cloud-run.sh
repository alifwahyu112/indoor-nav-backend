#!/bin/bash
# Script untuk deploy ke Google Cloud Run

set -e

# Configuration
PROJECT_ID="${1:-YOUR_PROJECT_ID}"
REGION="asia-southeast2"
SERVICE_NAME="indoor-nav-backend"
IMAGE_NAME="backend"
REPOSITORY="indoor-nav"

if [ "$PROJECT_ID" = "YOUR_PROJECT_ID" ]; then
  echo "❌ Error: PROJECT_ID not set"
  echo "Usage: ./deploy-cloud-run.sh <PROJECT_ID>"
  exit 1
fi

echo "🚀 Deploying to Google Cloud Run..."
echo "  Project: $PROJECT_ID"
echo "  Region: $REGION"
echo "  Service: $SERVICE_NAME"

# 1. Build Docker image
echo ""
echo "1️⃣ Building Docker image..."
docker build -t "$REGION-docker.pkg.dev/$PROJECT_ID/$REPOSITORY/$IMAGE_NAME:latest" .

# 2. Push ke Artifact Registry
echo ""
echo "2️⃣ Pushing to Artifact Registry..."
docker push "$REGION-docker.pkg.dev/$PROJECT_ID/$REPOSITORY/$IMAGE_NAME:latest"

# 3. Deploy ke Cloud Run
echo ""
echo "3️⃣ Deploying to Cloud Run..."
gcloud run deploy $SERVICE_NAME \
  --image="$REGION-docker.pkg.dev/$PROJECT_ID/$REPOSITORY/$IMAGE_NAME:latest" \
  --platform=managed \
  --region=$REGION \
  --memory=512Mi \
  --cpu=1 \
  --timeout=60s \
  --max-instances=10 \
  --no-allow-unauthenticated \
  --set-env-vars=DB_HOST=10.0.0.3,DB_USER=admin,DB_PASSWORD=ChangeMe123!,DB_NAME=indoor_navigation,SESSION_SECRET=your-secret-key,PORT=8080,NODE_ENV=production \
  --vpc-connector=indoor-nav-connector \
  --project=$PROJECT_ID

# 4. Get service URL
echo ""
echo "✅ Deployment complete!"
echo ""
SERVICE_URL=$(gcloud run services describe $SERVICE_NAME \
  --platform=managed \
  --region=$REGION \
  --format='value(status.url)' \
  --project=$PROJECT_ID)

echo "🔗 Service URL: $SERVICE_URL"
echo ""
echo "📊 View logs:"
echo "  gcloud run services logs read $SERVICE_NAME --region=$REGION --project=$PROJECT_ID"
echo ""
echo "🛑 To delete service:"
echo "  gcloud run services delete $SERVICE_NAME --region=$REGION --project=$PROJECT_ID"
