# Indoor Navigation Backend API

Backend server untuk aplikasi Indoor Navigation menggunakan **Express.js** dan **MySQL**.

## 🚀 Fitur

### Authentication
- Login admin dengan session
- Login API untuk mobile client
- Password hashing dengan bcryptjs

### Data Management
- **User**: CRUD untuk data pengguna
- **Map**: CRUD untuk data peta/ruangan
- **iNav**: CRUD untuk data navigasi
- **Admin**: CRUD untuk data admin

### API Endpoints
- `POST /api/login` - Login user
- `GET /api/get-map-data` - Ambil data peta
- `POST /api/scan-qr` - Proses scan QR Code
- `GET /api/get-inav-data` - Ambil data navigasi
- `GET /api/get-user-data` - Ambil data user
- `GET /api/map/:id` - Ambil detail peta by room_id

### Admin Panel (Web UI)
- Dashboard dengan EJS template
- Halaman login
- Manajemen user
- Manajemen peta
- Manajemen navigasi
- Manajemen admin

## 📋 Requirements

- Node.js >= 14
- MySQL 5.7+
- npm atau yarn

## 🔧 Installation

### 1. Clone Repository
```bash
git clone <repository-url>
cd tutorial-db-nodejs
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Setup Environment Variables
Buat file `.env` di root directory:
```env
# Database Configuration
DB_HOST=127.0.0.1
DB_USER=root
DB_PASSWORD=
DB_NAME=indoor navigation

# Server Configuration
PORT=8000
HOST=0.0.0.0

# Session Configuration
SESSION_SECRET=your-secret-key-here-change-in-production
```

### 4. Setup Database
Buat database MySQL dan import schema:
```sql
CREATE DATABASE `indoor navigation`;
```

Buat tabel yang diperlukan:
```sql
-- Admin Table
CREATE TABLE admin (
  id INT AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(50) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL
);

-- User Table
CREATE TABLE user (
  id INT AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(50) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,
  gmail VARCHAR(100),
  mobile_number VARCHAR(20),
  BPJS_number VARCHAR(20)
);

-- Map Table
CREATE TABLE map (
  id_map INT AUTO_INCREMENT PRIMARY KEY,
  Floor_ID INT,
  room_name VARCHAR(100),
  coordinates VARCHAR(255),
  room_id VARCHAR(50)
);

-- Navigation Table
CREATE TABLE inav (
  id INT AUTO_INCREMENT PRIMARY KEY,
  starting_position VARCHAR(255),
  target VARCHAR(255),
  history TEXT
);
```

## 🏃 Running Server

### Development (dengan auto-reload)
```bash
npm start
```

### Production (direct)
```bash
node server.js
```

Server akan berjalan pada `http://127.0.0.1:8000`

## 📝 API Usage Examples

### 1. Login
```bash
POST /api/login
Content-Type: application/json

{
  "username": "user123",
  "password": "password123"
}
```

### 2. Get Map Data
```bash
GET /api/get-map-data
```

### 3. Scan QR Code
```bash
POST /api/scan-qr
Content-Type: application/json

{
  "code": "room_001"
}
```

## 🔐 Security Notes

- ✅ Password hashing dengan bcryptjs (10 rounds)
- ✅ Environment variables untuk credentials
- ✅ CORS enabled
- ✅ Session management
- ⚠️ Pastikan ganti `SESSION_SECRET` di production
- ⚠️ Jangan commit `.env` file

## 📁 Project Structure

```
.
├── server.js              # Main server file
├── server.inav.js         # Empty file (untuk iNav future implementation)
├── package.json           # Dependencies
├── .env                   # Environment configuration (not in repo)
├── .gitignore             # Git ignore rules
├── buat_hash.php          # Utility untuk hash password
├── views/                 # EJS templates
│   ├── login.ejs         # Login page
│   ├── index.ejs         # User dashboard
│   ├── map.ejs           # Map management
│   ├── inav.ejs          # Navigation management
│   └── admin.ejs         # Admin management
└── README.md
```

## 🐛 Known Issues & TODOs

- [ ] Upgrade mysql ke mysql2 (deprecated)
- [ ] Add input validation di semua endpoints
- [ ] Add error handling yang lebih baik
- [ ] Add request logging/middleware
- [ ] Add rate limiting
- [ ] Add API documentation (Swagger/OpenAPI)

## 📦 Dependencies

- **express** ^5.1.0 - Web framework
- **mysql** ^2.18.1 - MySQL driver
- **bcryptjs** ^3.0.3 - Password hashing
- **express-session** ^1.18.2 - Session management
- **cors** ^2.8.5 - CORS middleware
- **ejs** ^3.1.10 - Template engine
- **dotenv** ^16.0.3 - Environment variables
- **nodemon** ^3.1.10 - Auto-reload (dev)

## 🤝 Contributing

Untuk kontribusi, silakan buat pull request ke branch yang sesuai.

## 📄 License

ISC

## 📧 Contact

Untuk pertanyaan atau masalah, silakan buat issue di repository ini.
