# Docker & Cloud Run Setup Guide

## 📦 Local Development dengan Docker Compose

### Prerequisites
- Docker Desktop installed
- Docker Compose installed

### Setup

1. **Build dan Run dengan Docker Compose:**
```bash
docker-compose up --build
```

Server akan berjalan di `http://localhost:8000` dan MySQL di `localhost:3306`

2. **Akses aplikasi:**
- Admin Panel: http://localhost:8000/login
- API Base: http://localhost:8000/api

3. **Stop services:**
```bash
docker-compose down

# Atau dengan cleanup volumes
docker-compose down -v
```

## 🚀 Deploy ke Google Cloud Run

### Prerequisites
```bash
# Install Google Cloud SDK
# https://cloud.google.com/sdk/docs/install

gcloud auth login
gcloud config set project YOUR_PROJECT_ID
```

### Setup Artifact Registry

```bash
# Enable services
gcloud services enable artifactregistry.googleapis.com
gcloud services enable run.googleapis.com
gcloud services enable cloudbuild.googleapis.com

# Create Artifact Registry repository
gcloud artifacts repositories create indoor-nav \
  --repository-format=docker \
  --location=asia-southeast2 \
  --description="Indoor Navigation Backend"

# Configure Docker auth
gcloud auth configure-docker asia-southeast2-docker.pkg.dev
```

### Setup Cloud SQL (Database)

```bash
# Enable Cloud SQL Admin API
gcloud services enable sqladmin.googleapis.com

# Create Cloud SQL instance
gcloud sql instances create indoor-nav-mysql \
  --database-version=MYSQL_8_0 \
  --tier=db-f1-micro \
  --region=asia-southeast2 \
  --availability-type=ZONAL

# Create database
gcloud sql databases create indoor_navigation \
  --instance=indoor-nav-mysql

# Create user
gcloud sql users create admin \
  --instance=indoor-nav-mysql \
  --password=ChangeMe123!  # Change this in production!

# Get Private IP (untuk internal connection)
gcloud sql instances describe indoor-nav-mysql \
  --format='value(ipAddresses[0].ipAddress)'
```

### Setup VPC Network

```bash
# Create VPC Network
gcloud compute networks create indoor-nav-network \
  --subnet-mode=custom

# Create subnet
gcloud compute networks subnets create indoor-nav-subnet \
  --network=indoor-nav-network \
  --range=10.0.0.0/28 \
  --region=asia-southeast2

# Connect Cloud SQL ke VPC
gcloud sql instances patch indoor-nav-mysql \
  --network=indoor-nav-network
```

### Deploy dengan Cloud Build

```bash
# Automatic build & deploy
gcloud builds submit --config cloudbuild.yaml

# Atau manual push
docker build -t asia-southeast2-docker.pkg.dev/YOUR_PROJECT_ID/indoor-nav/backend:latest .

docker push asia-southeast2-docker.pkg.dev/YOUR_PROJECT_ID/indoor-nav/backend:latest

# Deploy ke Cloud Run
gcloud run deploy indoor-nav-backend \
  --image=asia-southeast2-docker.pkg.dev/YOUR_PROJECT_ID/indoor-nav/backend:latest \
  --platform=managed \
  --region=asia-southeast2 \
  --memory=512Mi \
  --cpu=1 \
  --timeout=60s \
  --max-instances=10 \
  --no-allow-unauthenticated \
  --set-env-vars=DB_HOST=10.0.0.3,DB_USER=admin,DB_PASSWORD=ChangeMe123!,DB_NAME=indoor_navigation,SESSION_SECRET=your-secret-key,PORT=8080 \
  --vpc-connector=indoor-nav-connector
```

### Setup Cloud Run to Cloud SQL Connection

```bash
# Create VPC Connector
gcloud compute networks vpc-access connectors create outdoor-nav-connector \
  --network=indoor-nav-network \
  --region=asia-southeast2 \
  --min-instances=2 \
  --max-instances=3

# Update Cloud Run service untuk use VPC
gcloud run services update indoor-nav-backend \
  --vpc-connector=indoor-nav-connector \
  --region=asia-southeast2
```

## 🔒 Security Best Practices

### 1. Use Google Secret Manager

```bash
# Create secrets
echo -n "admin" | gcloud secrets create db-user --data-file=-
echo -n "ChangeMe123!" | gcloud secrets create db-password --data-file=-
echo -n "your-secret-key" | gcloud secrets create session-secret --data-file=-

# Update cloudbuild.yaml untuk reference secrets
# Lihat: https://cloud.google.com/build/docs/securing-builds/use-secrets
```

### 2. Configure IAM Permissions

```bash
# Create service account
gcloud iam service-accounts create indoor-nav-backend \
  --display-name="Indoor Navigation Backend"

# Grant Cloud SQL Client role
gcloud projects add-iam-policy-binding YOUR_PROJECT_ID \
  --member=serviceAccount:indoor-nav-backend@YOUR_PROJECT_ID.iam.gserviceaccount.com \
  --role=roles/cloudsql.client

# Grant Cloud Run role
gcloud projects add-iam-policy-binding YOUR_PROJECT_ID \
  --member=serviceAccount:indoor-nav-backend@YOUR_PROJECT_ID.iam.gserviceaccount.com \
  --role=roles/run.invoker
```

### 3. Use Private Google Cloud SQL (Recommended)

```bash
# Cloud SQL harus di private network saja
# Gunakan Cloud SQL Auth proxy untuk koneksi aman

# Update .env.production
DB_HOST=/cloudsql/PROJECT_ID:asia-southeast2:indoor-nav-mysql
```

## 📊 Monitoring & Logs

```bash
# View Cloud Run logs
gcloud run services describe indoor-nav-backend \
  --region=asia-southeast2

# Stream logs
gcloud run services logs read indoor-nav-backend \
  --region=asia-southeast2 \
  --limit=100 \
  --follow

# Cloud SQL logs
gcloud sql operations list --instance=indoor-nav-mysql
```

## 💰 Cost Optimization

1. **Cloud Run:**
   - Use smaller memory (256Mi) jika memungkinkan
   - Set max-instances sesuai kebutuhan
   - Use --no-allow-unauthenticated jika hanya internal

2. **Cloud SQL:**
   - Use db-f1-micro untuk development
   - db-n1-standard-2 untuk production
   - Enable automated backups

3. **Artifact Registry:**
   - Cleanup old images
   - Set retention policies

## 🐛 Troubleshooting

### Cloud Run can't connect to Cloud SQL

```bash
# Check VPC Connector status
gcloud compute networks vpc-access connectors describe indoor-nav-connector \
  --region=asia-southeast2

# Check Cloud SQL Private IP
gcloud sql instances describe indoor-nav-mysql \
  --format='value(ipAddresses[0].ipAddress)'
```

### Container failed to start

```bash
# Check logs
gcloud run services logs read indoor-nav-backend \
  --region=asia-southeast2 \
  --limit=50

# Test locally
docker run -it asia-southeast2-docker.pkg.dev/YOUR_PROJECT_ID/indoor-nav/backend:latest
```

### Database connection issues

```bash
# Test MySQL connectivity from Cloud Run instance
gcloud run services update indoor-nav-backend \
  --update-env-vars=DB_DEBUG=true \
  --region=asia-southeast2
```

## 📚 Resources

- [Google Cloud Run Documentation](https://cloud.google.com/run/docs)
- [Cloud SQL Documentation](https://cloud.google.com/sql/docs)
- [Docker Best Practices](https://docs.docker.com/develop/dev-best-practices)
- [VPC Access Connector](https://cloud.google.com/vpc/docs/configure-serverless-gke-access)

## 🤝 Support

Untuk bantuan lebih lanjut, dokumentasi lengkap ada di:
- Google Cloud Console: https://console.cloud.google.com
- Cloud Run docs: https://cloud.google.com/run/docs/quickstarts/build-and-deploy
