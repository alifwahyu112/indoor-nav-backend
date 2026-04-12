const express = require("express");
const mysql = require("mysql2");
const session = require("express-session");
const path = require("path");
const cors = require('cors');
const bcrypt = require('bcrypt'); 
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

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

// ===== Koneksi Database =====
const db = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME, 
  port: process.env.DB_PORT || 4000,
  ssl: { minVersion: 'TLSv1.2', rejectUnauthorized: true },
  waitForConnections: true,
  connectionLimit: 10
});

// ==========================================
// 1. ROUTES WEB DASHBOARD (EJS)
// ==========================================

// --- HALAMAN UTAMA (Data User) ---
app.get("/", (req, res) => {
  if (!req.session.loggedIn) return res.redirect("/login");
  db.query("SELECT * FROM user", (err, usersResult) => {
    if (err) return res.status(500).send("Database Error");
    res.render("index", { title: "DATA USER", users: usersResult });
  });
});

app.get("/login", (req, res) => res.render("login", { title: "Login Admin" }));

app.post("/login", (req, res) => {
  const { username, password } = req.body;
  db.query("SELECT * FROM admin WHERE username = ?", [username], async (err, result) => {
    if (err) return res.status(500).send("Database Error");
    if (result.length === 0) return res.send("❌ Login gagal! Username tidak ditemukan.");
    const match = await bcrypt.compare(password, result[0].password); 
    if (match) {
      req.session.loggedIn = true;
      res.redirect("/riwayat_perjalanan");
    } else {
      res.send("❌ Login gagal! Password salah.");
    }
  });
});

// --- RIWAYAT PERJALANAN ---
app.get("/riwayat_perjalanan", (req, res) => {
  if (!req.session.loggedIn) return res.redirect("/login");
  db.query("SELECT * FROM riwayat_perjalanan ORDER BY id DESC", (err, result) => {
    if (err) return res.status(500).send(err.message);
    res.render("riwayat_perjalanan", { title: "DATA RIWAYAT", riwayat_perjalanans: result });
  });
});

app.post("/tambah-riwayat_perjalanan", (req, res) => {
  const { user_id, mulai, tujuan, koordinat_awal } = req.body;
  const sql = `INSERT INTO riwayat_perjalanan (user_id, mulai, tujuan, koordinat_awal) VALUES (?, ?, ?, ?)`;
  db.query(sql, [user_id, mulai, tujuan, koordinat_awal], err => {
    if (err) return res.status(500).send(err.message);
    res.redirect("/riwayat_perjalanan");
  });
});

// --- MAP (Pintu yang tadi hilang) ---
app.get("/map", (req, res) => {
  if (!req.session.loggedIn) return res.redirect("/login");
  db.query("SELECT * FROM map", (err, mapResult) => {
    if (err) return res.status(500).send("Database Error");
    res.render("map", { title: "DATA MAP", maps: mapResult });
  });
});

// --- ADMIN (Pintu yang tadi hilang) ---
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
// 2. API ENDPOINTS (YANG DICARI UNITY)
// ==========================================

app.get("/api/get-room-list", (req, res) => {
  db.query("SELECT room_id, room_name FROM map ORDER BY room_name ASC", (err, result) => {
    if (err) return res.json({ status: false });
    res.json({ status: true, data: result });
  });
});

app.get("/api/map/:id", (req, res) => {
  db.query("SELECT * FROM map WHERE room_id = ?", [req.params.id], (err, result) => {
    if (err || result.length === 0) return res.status(404).json({ status: false });
    res.json(result[0]);
  });
});

app.post("/api/save-history", (req, res) => {
  const { user_id, mulai, tujuan, koordinat } = req.body;
  const sql = `INSERT INTO riwayat_perjalanan (user_id, mulai, tujuan, koordinat_awal) VALUES (?, ?, ?, ?)`;
  db.query(sql, [user_id, mulai, tujuan, koordinat], (err) => {
    if (err) return res.json({ status: false, error: err.message });
    res.json({ status: true, message: "History saved!" });
  });
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => console.log(`🚀 Server on port ${PORT}`));

module.exports = app;