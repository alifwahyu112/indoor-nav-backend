# 🚀 Quick Start Guide - Docker & Cloud Run

## 🐳 Local Development dengan Docker Compose

### 1️⃣ Prerequisites
- Docker Desktop installed dan running
- Git
- (Optional) Google Cloud SDK untuk Cloud Run deployment

### 2️⃣ Setup Local Environment

```bash
# Clone repository
git clone https://github.com/malifwahyuw-afk/tutorial-db-nodejs.git
cd tutorial-db-nodejs

# Setup .env file
cp .env.example .env
# Edit .env jika diperlukan (untuk local development, default sudah OK)
```

### 3️⃣ Run dengan Docker Compose

```bash
# Start database dan backend
docker-compose up --build

# Output akan menunjukkan:
# ✅ MySQL connected
# 🚀 Server running on http://127.0.0.1:8000
```

### 4️⃣ Access Aplikasi

```
🌐 Admin Panel:     http://localhost:8000/login
🌐 User Dashboard:  http://localhost:8000 (setelah login)
🌐 API Base:        http://localhost:8000/api
```

### 5️⃣ Stop Services

```bash
# Stop tapi keep data
docker-compose down

# Stop dan delete data
docker-compose down -v
```

---

## ☁️ Deploy ke Google Cloud Run (5 menit setup)

### 1️⃣ Prerequisites

```bash
# Install Google Cloud SDK
# https://cloud.google.com/sdk/docs/install

# Login
gcloud auth login

# Set project ID
gcloud config set project YOUR_PROJECT_ID

# Install Docker (jika belum ada)
docker --version
```

### 2️⃣ Quick Deploy Script

```bash
# Make script executable
chmod +x deploy-cloud-run.sh

# Run deployment
./deploy-cloud-run.sh YOUR_PROJECT_ID
```

### 3️⃣ Or Manual Setup (Step by Step)

**Setup Infrastructure:**
```bash
PROJECT_ID="your-project-id"
REGION="asia-southeast2"

# Enable APIs
gcloud services enable \
  artifactregistry.googleapis.com \
  run.googleapis.com \
  cloudbuild.googleapis.com \
  sqladmin.googleapis.com \
  --project=$PROJECT_ID

# Create Artifact Registry
gcloud artifacts repositories create indoor-nav \
  --repository-format=docker \
  --location=$REGION \
  --project=$PROJECT_ID

# Configure Docker auth
gcloud auth configure-docker $REGION-docker.pkg.dev

# Create Cloud SQL instance
gcloud sql instances create indoor-nav-mysql \
  --database-version=MYSQL_8_0 \
  --tier=db-f1-micro \
  --region=$REGION \
  --project=$PROJECT_ID

# Create database
gcloud sql databases create indoor_navigation \
  --instance=indoor-nav-mysql \
  --project=$PROJECT_ID

# Create user
gcloud sql users create admin \
  --instance=indoor-nav-mysql \
  --password=ChangeMe123! \
  --project=$PROJECT_ID
```

**Deploy Container:**
```bash
# Build
docker build -t $REGION-docker.pkg.dev/$PROJECT_ID/indoor-nav/backend:latest .

# Push
docker push $REGION-docker.pkg.dev/$PROJECT_ID/indoor-nav/backend:latest

# Deploy ke Cloud Run
gcloud run deploy indoor-nav-backend \
  --image=$REGION-docker.pkg.dev/$PROJECT_ID/indoor-nav/backend:latest \
  --platform=managed \
  --region=$REGION \
  --memory=512Mi \
  --cpu=1 \
  --no-allow-unauthenticated \
  --set-env-vars=DB_HOST=10.0.0.3,DB_USER=admin,DB_PASSWORD=ChangeMe123!,DB_NAME=indoor_navigation,SESSION_SECRET=your-secret-key,PORT=8080 \
  --project=$PROJECT_ID
```

### 4️⃣ Monitor Deployment

```bash
# Check service
gcloud run services describe indoor-nav-backend \
  --region=$REGION \
  --project=$PROJECT_ID

# Get service URL
gcloud run services describe indoor-nav-backend \
  --format='value(status.url)' \
  --region=$REGION \
  --project=$PROJECT_ID

# View logs
gcloud run services logs read indoor-nav-backend \
  --region=$REGION \
  --project=$PROJECT_ID \
  --limit=50
```

---

## 🧪 Verify Setup

### Local (Docker Compose)
```bash
# API Health Check
curl http://localhost:8000/login

# User Data (API)
curl http://localhost:8000/api/get-user-data

# Database Connection
curl http://localhost:8000/api/get-map-data
```

### Cloud Run
```bash
# Get token
TOKEN=$(gcloud auth print-identity-token)

# API Health Check
curl -H "Authorization: Bearer $TOKEN" \
  https://SERVICE_URL/login

# View logs
gcloud run services logs read indoor-nav-backend \
  --region=asia-southeast2 \
  --follow
```

---

## 📚 File Reference

| File | Purpose |
|------|---------|
| `Dockerfile` | Production-ready container image |
| `.dockerignore` | Exclude unnecessary files from image |
| `docker-compose.yml` | Local development stack (Node + MySQL) |
| `cloudbuild.yaml` | Automated CI/CD pipeline |
| `.env.example` | Environment configuration template |
| `DOCKER_CLOUD_RUN_SETUP.md` | Detailed setup guide |
| `TESTING_CHECKLIST.md` | Complete testing checklist |
| `setup-cloud-sql.sh` | Cloud SQL setup automation |
| `deploy-cloud-run.sh` | Deployment automation script |

---

## ⚙️ Configuration

### Environment Variables
```env
# Database
DB_HOST=mysql          # (docker-compose: mysql, cloud: 10.0.0.3)
DB_USER=admin
DB_PASSWORD=password
DB_NAME=indoor_navigation

# Server
PORT=8080
HOST=0.0.0.0

# Security
SESSION_SECRET=your-secret-key
NODE_ENV=production
```

### Docker Port Mapping
- **Local**: 8000:8000 (accessible at http://localhost:8000)
- **Cloud Run**: Auto port (8080 or specified PORT env)

---

## 🆘 Troubleshooting

### Docker Compose Issues

```bash
# Check services status
docker-compose ps

# Check logs
docker-compose logs backend
docker-compose logs mysql

# Rebuild
docker-compose down -v
docker-compose up --build

# Test MySQL connection
docker-compose exec backend nc -zv mysql 3306
```

### Cloud Run Issues

```bash
# Check service exists
gcloud run services list

# Check errors
gcloud run services logs read outdoor-nav-backend \
  --limit=100 \
  --format=json

# Delete and redeploy
gcloud run services delete indoor-nav-backend
# Then redeploy with deploy command
```

### Database Connection

```bash
# Test from container
docker-compose exec backend bash

# Inside container
mysql -h mysql -u root -p << EOF
SELECT 1;
SHOW DATABASES;
EOF
```

---

## 📊 Useful Commands

```bash
# Docker
docker ps                           # List running containers
docker logs -f CONTAINER_ID         # Follow logs
docker exec -it CONTAINER bash      # Shell access
docker build -t TAG .               # Build image

# Docker Compose
docker-compose up -d                # Run in background
docker-compose ps                   # Status
docker-compose logs -f              # Follow logs
docker-compose down -v              # Stop and remove volumes

# Google Cloud
gcloud run deploy SERVICE           # Deploy
gcloud run services list            # List services
gcloud run services logs read SVC   # View logs
gcloud sql instances list           # List databases
gcloud artifacts repositories list  # List registries
```

---

## 🔗 Resources

- [Dockerfile Best Practices](https://docs.docker.com/develop/dev-best-practices/)
- [Docker Compose Docs](https://docs.docker.com/compose/)
- [Cloud Run Quick Starts](https://cloud.google.com/run/docs/quickstarts)
- [Cloud SQL Documentation](https://cloud.google.com/sql/docs)
- [Google Cloud Console](https://console.cloud.google.com)

---

## 💡 Next Steps

1. **Local Testing**: Run `docker-compose up` dan test APIs
2. **Cloud SQL Setup**: Run `./setup-cloud-sql.sh`
3. **Deploy**: Run `./deploy-cloud-run.sh YOUR_PROJECT_ID`
4. **Monitor**: Check Cloud Logging dan Cloud Run metrics
5. **Production**: Setup Secret Manager dan SSL/TLS

---

## 🤝 Support

- **Local Development Issues**: Check `DOCKER_CLOUD_RUN_SETUP.md`
- **Testing**: See `TESTING_CHECKLIST.md`
- **Cloud Run**: See Google Cloud documentation
- **Database**: See Cloud SQL documentation

Happy coding! 🚀
