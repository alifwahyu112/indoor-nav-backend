const express = require("express");
const mysql = require("mysql2");
const session = require("express-session");
const path = require("path");
const cors = require('cors');
const bcrypt = require('bcrypt'); // Tambahan: Untuk Hashing Password
const axios = require('axios');   // Tambahan: Untuk Kirim WhatsApp OTP
require('dotenv').config();

const app = express();
const saltRounds = 10; // Standar keamanan hashing

// ===== Middleware =====
app.use(cors());
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(session({
  secret: process.env.SESSION_SECRET || "secret-key",
  resave: false,
  saveUninitialized: true
}));

// ===== View Engine =====
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

// ===== Koneksi Database (TiDB Pool) =====
const db = mysql.createPool({
  host: process.env.DB_HOST || "127.0.0.1",
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "",
  database: process.env.DB_NAME || "indoor_navigation", 
  port: process.env.DB_PORT || 4000,
  ssl: {
    minVersion: 'TLSv1.2',
    rejectUnauthorized: true
  },
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

db.getConnection((err, connection) => {
  if (err) {
    console.error("❌ Gagal koneksi ke database:", err.message);
  } else {
    console.log("✅ Connected to database pool...");
    connection.release();
  }
});

// ==========================================
// 1. ROUTES UNTUK ADMIN DASHBOARD (EJS)
// ==========================================

app.get("/login", (req, res) => {
  res.render("login", { title: "Login Admin" });
});

// Update: Login Admin menggunakan Bcrypt
app.post("/login", (req, res) => {
  const { username, password } = req.body;
  db.query("SELECT * FROM admin WHERE username = ?", [username], async (err, result) => {
    if (err) return res.status(500).send("Database Error");
    if (result.length === 0) return res.send("❌ Login gagal! Username tidak ditemukan.");
    
    const admin = result[0];
    const match = await bcrypt.compare(password, admin.password); // Cek hash

    if (match) {
      req.session.loggedIn = true;
      req.session.username = username;
      res.redirect("/");
    } else {
      res.send("❌ Login gagal! Password salah.");
    }
  });
});

app.get("/", (req, res) => {
  if (!req.session.loggedIn) return res.redirect("/login");
  db.query("SELECT * FROM user", (err, usersResult) => {
    if (err) return res.status(500).send("Database Error");
    res.render("index", { title: "DATA USER", users: usersResult });
  });
});

// Update: Tambah User dengan Hashing Password
app.post("/tambah", async (req, res) => {
  const { username, password, gmail, mobile_number, BPJS_number } = req.body;
  try {
    const hashedPassword = await bcrypt.hash(password, saltRounds);
    const sql = `INSERT INTO user (username, password, gmail, mobile_number, BPJS_number) VALUES (?, ?, ?, ?, ?)`;
    db.query(sql, [username, hashedPassword, gmail, mobile_number, BPJS_number], err => {
      if (err) return res.status(500).send("Database Error");
      res.redirect("/");
    });
  } catch (e) {
    res.status(500).send("Error hashing password");
  }
});

// Update: Tambah Admin dengan Hashing Password
app.post("/tambah-admin", async (req, res) => {
  const { username, password } = req.body;
  try {
    const hashedPassword = await bcrypt.hash(password, saltRounds);
    db.query("INSERT INTO admin (username, password) VALUES (?, ?)", [username, hashedPassword], err => {
      if (err) return res.status(500).send("Database Error");
      res.redirect("/admin");
    });
  } catch (e) {
    res.status(500).send("Error");
  }
});

// --- Route Admin Lainnya Tetap Sama ---
app.get("/delete-user/:id", (req, res) => {
  if (!req.session.loggedIn) return res.redirect("/login");
  db.query("DELETE FROM user WHERE id = ?", [req.params.id], err => {
    if (err) return res.status(500).send("Database Error");
    res.redirect("/");
  });
});

app.get("/map", (req, res) => {
  if (!req.session.loggedIn) return res.redirect("/login");
  db.query("SELECT * FROM map", (err, mapResult) => {
    if (err) return res.status(500).send("Database Error");
    res.render("map", { title: "DATA MAP", maps: mapResult });
  });
});

app.post("/tambah-map", (req, res) => {
  const { Floor_ID, room_name, coordinates, room_id } = req.body;
  const sql = `INSERT INTO map (Floor_ID, room_name, coordinates, room_id) VALUES (?, ?, ?, ?)`;
  db.query(sql, [Floor_ID, room_name, coordinates, room_id], err => {
    if (err) return res.status(500).send("Database Error");
    res.redirect("/map");
  });
});

app.post("/update-map", (req, res) => {
  const { id_map, Floor_ID, room_name, coordinates, room_id } = req.body;
  const sql = `UPDATE map SET Floor_ID = ?, room_name = ?, coordinates = ?, room_id = ? WHERE id_map = ?`;
  db.query(sql, [Floor_ID, room_name, coordinates, room_id, id_map], err => {
    if (err) return res.status(500).send("Database Error");
    res.redirect("/map");
  });
});

app.get("/delete-map/:id", (req, res) => {
  if (!req.session.loggedIn) return res.redirect("/login");
  db.query("DELETE FROM map WHERE id_map = ?", [req.params.id], err => {
    if (err) return res.status(500).send("Database Error");
    res.redirect("/map");
  });
});

app.get("/riwayat_perjalanan", (req, res) => {
  if (!req.session.loggedIn) return res.redirect("/login");
  db.query("SELECT * FROM riwayat_perjalanan ORDER BY id DESC", (err, riwayat_perjalananResult) => {
    if (err) return res.status(500).send("Database Error");
    res.render("riwayat_perjalanan", { title: "DATA RIWAYAT PERJALANAN", riwayat_perjalanan: riwayat_perjalananResult });
  });
});

app.post("/tambah-riwayat_perjalanan", (req, res) => {
  const { user_id, mulai, tujuan, koordinat_awal, tanggal } = req.body;
  const sql = `INSERT INTO riwayat_perjalanan (user_id, muali, tujuan, koordinat_awal, tanggal) VALUES (?, ?, ?, ?, ?)`;
  db.query(sql, [user_id, mulai, tujuan, koordinat_awal, tanggal], err => {
    if (err) return res.status(500).send("Database Error");
    res.redirect("/riwayat_perjalanan");
  });
});

app.get("/delete-riwayat_perjalanan/:id", (req, res) => {
  if (!req.session.loggedIn) return res.redirect("/login");
  db.query("DELETE FROM riwayat_perjalanan WHERE id = ?", [req.params.id], err => {
    if (err) return res.status(500).send("Database Error");
    res.redirect("/riwayat_perjalanan");
  });
});

app.get("/admin", (req, res) => {
  if (!req.session.loggedIn) return res.redirect("/login");
  db.query("SELECT * FROM admin", (err, adminResult) => {
    if (err) return res.status(500).send("Database Error");
    res.render("admin", { title: "DATA ADMIN", admins: adminResult });
  });
});

app.get("/delete-admin/:id", (req, res) => {
  if (!req.session.loggedIn) return res.redirect("/login");
  db.query("DELETE FROM admin WHERE id = ?", [req.params.id], err => {
    if (err) return res.status(500).send("Database Error");
    res.redirect("/admin");
  });
});

app.get("/logout", (req, res) => {
  req.session.destroy(err => {
    if (err) console.error(err);
    res.redirect("/login");
  });
});

// ==========================================
// 2. API ENDPOINTS (Untuk Mobile/Unity)
// ==========================================

// Update: API Login menggunakan Bcrypt
app.post("/api/login", (req, res) => {
  const { username, password } = req.body;
  db.query("SELECT * FROM user WHERE username = ?", [username], async (err, result) => {
    if (err) return res.json({ status: false, message: "Server Error" });
    if (result.length === 0) return res.json({ status: false, message: "User tidak ditemukan" });

    const user = result[0];
    const match = await bcrypt.compare(password, user.password); // Verifikasi Hash

    if (match) {
      res.json({ status: true, message: "Login Berhasil", username: user.username, id: user.id });
    } else {
      res.json({ status: false, message: "Password Salah" });
    }
  });
});

// --- FITUR LUPA PASSWORD & OTP WHATSAPP ---

// A. Minta OTP
app.post("/api/forgot-password", (req, res) => {
  const { mobile_number } = req.body;
  const otp = Math.floor(100000 + Math.random() * 900000); // Generate 6 Digit
  const expiry = new Date(Date.now() + 5 * 60000); // Berlaku 5 Menit

  db.query("UPDATE user SET otp_code = ?, otp_expiry = ? WHERE mobile_number = ?", [otp, expiry, mobile_number], (err, result) => {
    if (err || result.affectedRows === 0) return res.json({ status: false, message: "Nomor tidak terdaftar" });

    // Kirim pesan via Fonnte (Silakan daftar di fonnte.com untuk token)
    axios.post('https://api.fonnte.com/send', {
      target: mobile_number,
      message: `Kode OTP Anda adalah: ${otp}. Masukkan kode ini di aplikasi untuk mengganti password. Berhenti memberikan kode kepada siapapun!`,
    }, {
      headers: { 'Authorization': 'TOKEN_FONNTE_KAMU_DISINI' } 
    }).then(() => {
      res.json({ status: true, message: "OTP berhasil dikirim ke WhatsApp" });
    }).catch(e => {
      res.json({ status: false, message: "Gagal mengirim pesan WhatsApp" });
    });
  });
});

// B. Verifikasi OTP & Reset Password
app.post("/api/reset-password", async (req, res) => {
  const { mobile_number, otp, newPassword } = req.body;

  db.query("SELECT * FROM user WHERE mobile_number = ? AND otp_code = ?", [mobile_number, otp], async (err, result) => {
    if (err || result.length === 0) return res.json({ status: false, message: "Kode OTP Salah" });

    const user = result[0];
    // Cek apakah sudah kadaluwarsa
    if (new Date() > new Date(user.otp_expiry)) return res.json({ status: false, message: "OTP sudah kadaluwarsa" });

    // Hash password baru sebelum disimpan
    const hashedNewPassword = await bcrypt.hash(newPassword, saltRounds);

    db.query("UPDATE user SET password = ?, otp_code = NULL, otp_expiry = NULL WHERE mobile_number = ?", [hashedNewPassword, mobile_number], (err) => {
      if (err) return res.json({ status: false, message: "Gagal reset password" });
      res.json({ status: true, message: "Password berhasil diperbarui!" });
    });
  });
});

// --- API Lainnya Tetap Sama ---

app.get("/api/get-room-list", (req, res) => {
  db.query("SELECT room_id, room_name FROM map ORDER BY room_name ASC", (err, result) => {
    if (err) return res.json({ status: false, message: "Gagal mengambil daftar ruangan" });
    res.json({ status: true, data: result });
  });
});

app.get("/api/map/:id", (req, res) => {
  db.query("SELECT * FROM map WHERE room_id = ?", [req.params.id], (err, result) => {
    if (err) return res.status(500).json({ status: false, error: "Database Error" });
    if (result.length === 0) return res.status(404).json({ status: false, message: "Room ID Not Found" });
    res.json(result[0]);
  });
});

app.post('/api/riwayat_perjalanan/start', (req, res) => {
  const { session_id, starting_position } = req.body;
  if (!session_id || !starting_position) return res.json({ status: false, message: "Data tidak lengkap" });

  const historyStr = new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' });
  const sql = 'INSERT INTO riwayat_perjalanan (session_id, starting_position, history) VALUES (?, ?, ?)';
  
  db.query(sql, [session_id, starting_position, historyStr], (err, result) => {
    if (err) return res.status(500).json({ status: false, error: err.message });
    res.json({ status: true, message: "Aktivitas dimulai, posisi awal tercatat" });
  });
});

app.put('/api/riwayat_perjalanan/update-target', (req, res) => {
  const { session_id, target } = req.body;
  if (!session_id || !target) return res.json({ status: false, message: "Data tidak lengkap" });

  const sql = 'UPDATE riwayat_perjalanan SET target = ? WHERE session_id = ? ORDER BY id DESC LIMIT 1';
  
  db.query(sql, [target, session_id], (err, result) => {
    if (err) return res.status(500).json({ status: false, error: err.message });
    if (result.affectedRows > 0) {
      res.json({ status: true, message: "Tujuan berhasil diperbarui" });
    } else {
      res.status(404).json({ status: false, message: "Sesi tidak ditemukan" });
    }
  });
});

// KODE YANG SUDAH DIPERBAIKI (Ganti bagian ini di server.js kamu)
app.get("/buat-admin-pertama", async (req, res) => {
  const username = "admin";
  const password = "admin123"; 
  const hashedPassword = await bcrypt.hash(password, saltRounds);

  db.query("INSERT INTO admin (username, password) VALUES (?, ?)", [username, hashedPassword], (err) => {
    if (err) return res.status(500).send("Gagal: " + err.message);
    res.send(`✅ Admin berhasil dibuat! Username: ${username}, Password: ${password}`);
  });
});

// ==========================================
// 3. PENGATURAN JALAN SERVER
// ==========================================

if (process.env.NODE_ENV !== 'production') {
  const PORT = process.env.PORT || 8000;
  const HOST = process.env.HOST || "0.0.0.0";
  app.listen(PORT, HOST, () => {
    console.log(`🚀 Server running on http://127.0.0.1:${PORT}`);
  });
}

module.exports = app;