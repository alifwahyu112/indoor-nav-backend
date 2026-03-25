#!/bin/bash
# Script untuk setup Cloud SQL dengan Private IP dan VPC

PROJECT_ID="YOUR_PROJECT_ID"
REGION="asia-southeast2"
INSTANCE_NAME="indoor-nav-mysql"
DB_NAME="indoor_navigation"
DB_USER="admin"
DB_PASSWORD="ChangeMe123!"  # Change this!
NETWORK_NAME="indoor-nav-network"

echo "🚀 Setting up Google Cloud SQL..."

# 1. Enable APIs
echo "1️⃣ Enabling Google Cloud APIs..."
gcloud services enable sqladmin.googleapis.com \
  --project=$PROJECT_ID

# 2. Create VPC Network (jika belum ada)
echo "2️⃣ Creating VPC Network..."
gcloud compute networks create $NETWORK_NAME \
  --subnet-mode=custom \
  --project=$PROJECT_ID \
  2>/dev/null || echo "Network already exists"

# 3. Create Subnet
echo "3️⃣ Creating subnet..."
gcloud compute networks subnets create "$NETWORK_NAME-subnet" \
  --network=$NETWORK_NAME \
  --range=10.0.0.0/28 \
  --region=$REGION \
  --project=$PROJECT_ID \
  2>/dev/null || echo "Subnet already exists"

# 4. Reserve IP range untuk VPC Peering
echo "4️⃣ Reserving IP range for VPC peering..."
gcloud compute addresses create "google-managed-services-$NETWORK_NAME" \
  --global \
  --purpose=VPC_PEERING \
  --prefix-length=16 \
  --network=$NETWORK_NAME \
  --project=$PROJECT_ID \
  2>/dev/null || echo "IP range already reserved"

# 5. Create Private Connection
echo "5️⃣ Creating Private Service Connection..."
gcloud services vpc-peerings connect \
  --service=servicenetworking.googleapis.com \
  --ranges="google-managed-services-$NETWORK_NAME" \
  --network=$NETWORK_NAME \
  --project=$PROJECT_ID \
  2>/dev/null || echo "Connection already exists"

# 6. Create Cloud SQL Instance
echo "6️⃣ Creating Cloud SQL Instance..."
gcloud sql instances create $INSTANCE_NAME \
  --database-version=MYSQL_8_0 \
  --tier=db-f1-micro \
  --region=$REGION \
  --network=$NETWORK_NAME \
  --availability-type=ZONAL \
  --enable-bin-log \
  --project=$PROJECT_ID \
  2>/dev/null || echo "Instance already exists"

# 7. Create database
echo "7️⃣ Creating database..."
gcloud sql databases create $DB_NAME \
  --instance=$INSTANCE_NAME \
  --project=$PROJECT_ID \
  2>/dev/null || echo "Database already exists"

# 8. Create user
echo "8️⃣ Creating database user..."
gcloud sql users create $DB_USER \
  --instance=$INSTANCE_NAME \
  --password=$DB_PASSWORD \
  --project=$PROJECT_ID \
  2>/dev/null || echo "User already exists"

# 9. Get Private IP
echo "9️⃣ Getting Private IP..."
PRIVATE_IP=$(gcloud sql instances describe $INSTANCE_NAME \
  --format='value(ipAddresses[0].ipAddress)' \
  --project=$PROJECT_ID)

echo ""
echo "✅ Cloud SQL setup complete!"
echo ""
echo "📋 Configuration details:"
echo "  Instance: $INSTANCE_NAME"
echo "  Region: $REGION"
echo "  Database: $DB_NAME"
echo "  User: $DB_USER"
echo "  Private IP: $PRIVATE_IP"
echo "  Network: $NETWORK_NAME"
echo ""
echo "🔐 Update your .env file with:"
echo "  DB_HOST=$PRIVATE_IP"
echo "  DB_USER=$DB_USER"
echo "  DB_PASSWORD=$DB_PASSWORD"
echo "  DB_NAME=$DB_NAME"
echo ""
echo "For Cloud Run, use VPC Connector to access this instance."
