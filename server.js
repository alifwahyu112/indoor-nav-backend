const express = require("express");
const mysql = require("mysql2");
const session = require("express-session");
const path = require("path");
const cors = require('cors');
const bcrypt = require('bcrypt'); 
const axios = require('axios'); 
require('dotenv').config();

const app = express();
const saltRounds = 10; 

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

// ==========================================
// 1. ROUTES UNTUK ADMIN DASHBOARD (EJS)
// ==========================================

// --- LOGIN ---
app.get("/login", (req, res) => {
  res.render("login", { title: "Login Admin" });
});

app.post("/login", (req, res) => {
  const { username, password } = req.body;
  db.query("SELECT * FROM admin WHERE username = ?", [username], async (err, result) => {
    if (err) return res.status(500).send("Database Error");
    if (result.length === 0) return res.send("❌ Login gagal! Username tidak ditemukan.");
    
    const admin = result[0];
    const match = await bcrypt.compare(password, admin.password); 

    if (match) {
      req.session.loggedIn = true;
      req.session.username = username;
      res.redirect("/");
    } else {
      res.send("❌ Login gagal! Password salah.");
    }
  });
});

// --- DASHBOARD USER ---
app.get("/", (req, res) => {
  if (!req.session.loggedIn) return res.redirect("/login");
  db.query("SELECT * FROM user", (err, usersResult) => {
    if (err) return res.status(500).send("Database Error");
    res.render("index", { title: "DATA USER", users: usersResult });
  });
});

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

// --- RIWAYAT PERJALANAN (iNav) ---
app.get("/riwayat_perjalanan", (req, res) => {
  if (!req.session.loggedIn) return res.redirect("/login");
  
  // Mengambil data dari tabel riwayat_perjalanan
  db.query("SELECT * FROM riwayat_perjalanan ORDER BY id DESC", (err, result) => {
    if (err) return res.status(500).send("Database Error: " + err.message);
    
    // Pastikan nama variabel 'riwayat_perjalanans' sama dengan yang dipanggil di EJS
    res.render("riwayat_perjalanan", { 
      title: "DATA RIWAYAT PERJALANAN", 
      riwayat_perjalanans: result 
    });
  });
});

app.post("/tambah-riwayat_perjalanan", (req, res) => {
  const { user_id, mulai, tujuan, koordinat_awal, tanggal } = req.body;
  
  // Perbaikan typo 'muali' menjadi 'mulai'
  const sql = `INSERT INTO riwayat_perjalanan (user_id, mulai, tujuan, koordinat_awal, tanggal) VALUES (?, ?, ?, ?, ?)`;
  
  db.query(sql, [user_id, mulai, tujuan, koordinat_awal, tanggal], err => {
    if (err) return res.status(500).send("Database Error: " + err.message);
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

// --- MAP & ADMIN (LAINNYA) ---
app.get("/map", (req, res) => {
  if (!req.session.loggedIn) return res.redirect("/login");
  db.query("SELECT * FROM map", (err, mapResult) => {
    if (err) return res.status(500).send("Database Error");
    res.render("map", { title: "DATA MAP", maps: mapResult });
  });
});

app.get("/admin", (req, res) => {
  if (!req.session.loggedIn) return res.redirect("/login");
  db.query("SELECT * FROM admin", (err, adminResult) => {
    if (err) return res.status(500).send("Database Error");
    res.render("admin", { title: "DATA ADMIN", admins: adminResult });
  });
});

app.get("/logout", (req, res) => {
  req.session.destroy(() => res.redirect("/login"));
});

// ==========================================
// 2. API ENDPOINTS (Mobile/Unity)
// ==========================================

app.post("/api/login", (req, res) => {
  const { username, password } = req.body;
  db.query("SELECT * FROM user WHERE username = ?", [username], async (err, result) => {
    if (err) return res.json({ status: false, message: "Server Error" });
    if (result.length === 0) return res.json({ status: false, message: "User tidak ditemukan" });

    const user = result[0];
    const match = await bcrypt.compare(password, user.password); 

    if (match) {
      res.json({ status: true, message: "Login Berhasil", username: user.username, id: user.id });
    } else {
      res.json({ status: false, message: "Password Salah" });
    }
  });
});

// API untuk mencatat awal perjalanan dari Unity/Mobile
app.post('/api/riwayat_perjalanan/start', (req, res) => {
  const { user_id, mulai, tujuan, koordinat_awal } = req.body;
  const sql = 'INSERT INTO riwayat_perjalanan (user_id, mulai, tujuan, koordinat_awal) VALUES (?, ?, ?, ?)';
  
  db.query(sql, [user_id, mulai, tujuan, koordinat_awal], (err, result) => {
    if (err) return res.status(500).json({ status: false, error: err.message });
    res.json({ status: true, message: "Riwayat perjalanan berhasil dicatat" });
  });
});

// ==========================================
// 3. JALANKAN SERVER
// ==========================================
const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});

module.exports = app;