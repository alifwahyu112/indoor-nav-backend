# Docker & Cloud Run Test Checklist

## 🐳 Docker Setup Verification

### Local Docker Build Test
```bash
# Build image
docker build -t indoor-nav-backend:latest .

# Check image
docker images | grep indoor-nav-backend

# Run container
docker run -d \
  -p 8000:8000 \
  -e DB_HOST=host.docker.internal \
  -e DB_USER=root \
  -e DB_PASSWORD=root \
  -e DB_NAME="indoor navigation" \
  --name indoor-nav-test \
  indoor-nav-backend:latest

# Check logs
docker logs indoor-nav-test

# Test API
curl http://localhost:8000/login

# Stop container
docker stop indoor-nav-test
docker rm indoor-nav-test
```

## 🐳 Docker Compose Test

### Full Stack Test
```bash
# Start full stack
docker-compose up -d

# Wait for services to be healthy
sleep 10

# Test API
curl http://localhost:8000/login

# Check database connection
curl http://localhost:8000/api/get-user-data

# View logs
docker-compose logs -f backend

# Stop stack
docker-compose down
```

## ☁️ Google Cloud Setup Verification

### 1. Project Setup
```bash
# Check default project
gcloud config get-value project

# Set project if needed
gcloud config set project YOUR_PROJECT_ID

# Check active account
gcloud auth list
```

### 2. API Enablement
```bash
# Check enabled APIs
gcloud services list --enabled | grep -E "(artifactregistry|run|cloudbuild|sqladmin)"

# Should show:
# - artifactregistry.googleapis.com
# - run.googleapis.com
# - cloudbuild.googleapis.com
# - sqladmin.googleapis.com
```

### 3. Artifact Registry
```bash
# Check repository
gcloud artifacts repositories describe indoor-nav \
  --location=asia-southeast2

# Test authentication
gcloud auth configure-docker asia-southeast2-docker.pkg.dev
```

### 4. Cloud SQL
```bash
# Check instance
gcloud sql instances describe indoor-nav-mysql

# Check databases
gcloud sql databases list --instance=indoor-nav-mysql

# Check users
gcloud sql users list --instance=indoor-nav-mysql

# Get private IP
gcloud sql instances describe indoor-nav-mysql \
  --format='value(ipAddresses[0].ipAddress)'
```

### 5. VPC Network
```bash
# Check network
gcloud compute networks describe indoor-nav-network

# Check subnet
gcloud compute networks subnets describe indoor-nav-subnet \
  --region=asia-southeast2

# Check VPC Connector
gcloud compute networks vpc-access connectors describe indoor-nav-connector \
  --region=asia-southeast2
```

### 6. Cloud Run Service
```bash
# Check service
gcloud run services describe indoor-nav-backend \
  --region=asia-southeast2

# Get service URL
gcloud run services describe indoor-nav-backend \
  --format='value(status.url)' \
  --region=asia-southeast2

# Test service health
curl -H "Authorization: Bearer $(gcloud auth print-identity-token)" \
  https://SERVICE_URL/login

# View logs
gcloud run services logs read indoor-nav-backend \
  --region=asia-southeast2 \
  --limit=50
```

## 🧪 Test Cases

### API Tests
- [ ] GET /login → render login page
- [ ] POST /login → successful login redirects to /
- [ ] GET / → redirect to /login (no session)
- [ ] GET / → show user list (with session)
- [ ] POST /api/login → return JSON response
- [ ] GET /api/get-map-data → return map data
- [ ] POST /api/scan-qr → process QR code
- [ ] GET /api/map/:id → return room data

### Database Tests
- [ ] Connection successful
- [ ] Can insert user
- [ ] Can read user
- [ ] Can update user
- [ ] Can delete user
- [ ] Can insert map data
- [ ] Can query map by room_id

### Docker Tests
- [ ] Image builds without errors
- [ ] Container starts successfully
- [ ] Port 8000 is accessible
- [ ] Environment variables are loaded
- [ ] Health check passes

### Cloud Run Tests
- [ ] Service deploys successfully
- [ ] Environment variables are set
- [ ] Can access service URL
- [ ] Database connection works
- [ ] Session management works
- [ ] Logs are visible in Cloud Logging

## 📊 Performance Tests

### Load Testing
```bash
# Install Apache Bench
apt-get install apache2-utils  # Linux
brew install httpd  # macOS

# Test local
ab -n 1000 -c 10 http://localhost:8000/

# Test Cloud Run
ab -n 1000 -c 10 https://SERVICE_URL/
```

### Memory & CPU Check
```bash
# Docker local
docker stats indoor-nav-backend

# Cloud Run
gcloud run services describe indoor-nav-backend \
  --format='value(spec.template.spec.containers[0].resources.limits)'
```

## 🔒 Security Verification

- [ ] No credentials in Dockerfile
- [ ] No credentials in .env file (should use .env.example)
- [ ] .env in .gitignore
- [ ] node_modules in .gitignore
- [ ] alif/ in .gitignore
- [ ] Cloud Run service not public (no-allow-unauthenticated)
- [ ] Database password in Secret Manager
- [ ] VPC Connector configured
- [ ] Private IP for Cloud SQL

## 📝 Pre-Production Checklist

- [ ] All tests passed
- [ ] Security review complete
- [ ] Environment variables configured
- [ ] Database backups enabled
- [ ] Cloud SQL monitoring enabled
- [ ] Cloud Run monitoring enabled
- [ ] Logging configured
- [ ] SSL/TLS enabled
- [ ] Error handling configured
- [ ] Rate limiting configured

## 🚀 Production Deployment

```bash
# 1. Setup secrets
gcloud secrets create db-password --data-file=/dev/stdin

# 2. Setup Cloud SQL with backup
gcloud sql backups create \
  --instance=indoor-nav-mysql

# 3. Deploy with Cloud Build
gcloud builds submit --config cloudbuild.yaml

# 4. Monitor
gcloud run services logs read indoor-nav-backend \
  --region=asia-southeast2 \
  --follow
```

## 🆘 Troubleshooting

### Container fails to start
```bash
# Check image
docker run -it indoor-nav-backend:latest /bin/sh

# Check logs
docker logs CONTAINER_ID
```

### Database connection fails
```bash
# Check MySQL is running in docker-compose
docker-compose ps

# Test connection from container
docker-compose exec backend mysql -h mysql -u root -p -e "USE \`indoor navigation\`; SHOW TABLES;"
```

### Cloud Run service errors
```bash
# Check recent logs
gcloud run services logs read indoor-nav-backend \
  --region=asia-southeast2 \
  --limit=100

# Check metrics
gcloud monitoring dashboards create \
  --config='resource.type=cloud_run_revision&metric.type=run.googleapis.com/request_count'
```

