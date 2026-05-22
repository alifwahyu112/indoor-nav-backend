const express = require("express");
const mysql = require("mysql2");
const session = require("express-session");
const path = require("path");
const cors = require('cors');
const bcrypt = require('bcrypt'); 
require('dotenv').config();

const MySQLStore = require('express-mysql-session')(session);

const app = express();
const saltRounds = 10; 

// ===== Middleware =====
app.use(cors());
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// PENTING: Agar session awet di Vercel
app.set('trust proxy', 1); 

app.use(session({
  secret: process.env.SESSION_SECRET || "secret-key",
  resave: false,
  saveUninitialized: true,
  cookie: { secure: process.env.NODE_ENV === 'production' } // Secure jika di Vercel
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

app.get("/delete-user/:id", (req, res) => {
  if (!req.session.loggedIn) return res.redirect("/login");
  db.query("DELETE FROM user WHERE id = ?", [req.params.id], err => {
    if (err) return res.status(500).send(err.message);
    res.redirect("/"); 
  });
});

app.post("/tambah", async (req, res) => {
  if (!req.session.loggedIn) return res.redirect("/login");
  
  const { username, password, gmail, mobile_number, BPJS_number } = req.body;
  
  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    
    const sql = `INSERT INTO user (username, password, gmail, mobile_number, BPJS_number) VALUES (?, ?, ?, ?, ?)`;
    db.query(sql, [username, hashedPassword, gmail, mobile_number, BPJS_number], err => {
      if (err) return res.status(500).send("Gagal menambah user: " + err.message);
      res.redirect("/"); 
    });
  } catch (error) {
    res.status(500).send("Error saat melakukan enkripsi password");
  }
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

// 1. Rute LOGIN (Bisa diakses publik)
app.get("/login", (req, res) => res.render("login", { title: "Login Admin" }));

app.post("/login", (req, res) => {
    // ... logika login kamu ...
});

// 2. Rute FORGOT PASSWORD (Harus bisa diakses publik karena admin sedang lupa password)
app.post("/forgot-password", (req, res) => {
    const { email } = req.body;
    db.query("SELECT * FROM admin WHERE email = ?", [email], (err, result) => {
        if (err) return res.status(500).send("Database Error");
        
        if (result.length > 0) {
            res.send("Link reset telah dikirim ke email Anda.");
        } else {
            res.send("Jika email terdaftar, link reset telah dikirim.");
        }
    });
});

// 3. Rute Dashboard (Wajib Login)
// Pastikan rute setelah ini baru melakukan pengecekan req.session.loggedIn
app.get("/", (req, res) => {
    if (!req.session.loggedIn) return res.redirect("/login");
    // ...
});

// --- RIWAYAT PERJALANAN ---
app.get("/riwayat_perjalanan", (req, res) => {
  if (!req.session.loggedIn) return res.redirect("/login");
  db.query("SELECT * FROM riwayat_perjalanan ORDER BY id DESC", (err, result) => {
    if (err) return res.status(500).send(err.message);
    res.render("riwayat_perjalanan", { title: "DATA RIWAYAT", riwayat_perjalanans: result });
  });
});

// FIX: Menambahkan kolom 'room' agar tidak error 500
app.post("/tambah-riwayat_perjalanan", (req, res) => {
  const { user_id, mulai, tujuan, koordinat_awal, room } = req.body;
  const sql = `INSERT INTO riwayat_perjalanan (user_id, mulai, tujuan, koordinat_awal, room) VALUES (?, ?, ?, ?, ?)`;
  db.query(sql, [user_id, mulai, tujuan, koordinat_awal, room], err => {
    if (err) return res.status(500).send(err.message);
    res.redirect("/riwayat_perjalanan");
  });
});

app.get("/delete-riwayat_perjalanan/:id", (req, res) => {
  if (!req.session.loggedIn) return res.redirect("/login");
  db.query("DELETE FROM riwayat_perjalanan WHERE id = ?", [req.params.id], err => {
    if (err) return res.status(500).send(err.message);
    res.redirect("/riwayat_perjalanan");
  });
});

// --- MAP (DATA RUANGAN) ---
app.get("/map", (req, res) => {
  if (!req.session.loggedIn) return res.redirect("/login");
  db.query("SELECT * FROM map", (err, mapResult) => {
    if (err) return res.status(500).send("Database Error");
    res.render("map", { title: "DATA MAP", maps: mapResult });
  });
});

// FIX: Tambah Map
app.post("/tambah-map", (req, res) => {
  const { Floor_ID, room_name, coordinates, room_id } = req.body;
  const sql = `INSERT INTO map (Floor_ID, room_name, coordinates, room_id) VALUES (?, ?, ?, ?)`;
  db.query(sql, [Floor_ID, room_name, coordinates, room_id], err => {
    if (err) return res.status(500).send(err.message);
    res.redirect("/map");
  });
});

// FIX UTAMA: Update Map (Mencegah Error Cannot POST /update-map)
app.post("/update-map", (req, res) => {
  const { id_map, Floor_ID, room_name, coordinates, room_id } = req.body;
  const sql = `UPDATE map SET Floor_ID = ?, room_name = ?, coordinates = ?, room_id = ? WHERE id_map = ?`;
  db.query(sql, [Floor_ID, room_name, coordinates, room_id, id_map], err => {
    if (err) return res.status(500).send("Gagal update: " + err.message);
    res.redirect("/map");
  });
});

// FIX: Hapus Map
app.get("/delete-map/:id", (req, res) => {
  if (!req.session.loggedIn) return res.redirect("/login");
  db.query("DELETE FROM map WHERE id_map = ?", [req.params.id], err => {
    if (err) return res.status(500).send(err.message);
    res.redirect("/map");
  });
});

// --- ADMIN ---
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
    if (err) return res.status(500).send(err.message);
    res.redirect("/admin");
  });
});

app.post("/tambah-admin", async (req, res) => {
  if (!req.session.loggedIn) return res.redirect("/login");
  
  const { username, password } = req.body;
  const hashedPassword = await bcrypt.hash(password, 10);
  
  const sql = `INSERT INTO admin (username, password) VALUES (?, ?)`;
  db.query(sql, [username, hashedPassword], err => {
    if (err) return res.status(500).send("Gagal menambah admin: " + err.message);
    res.redirect("/admin");
  });
});

// --- LOGOUT ---
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

// FIX: Menambahkan kolom 'room' dan sinkronisasi 5 parameter
app.post("/api/save-history", (req, res) => {
  const { user_id, mulai, tujuan, koordinat, room } = req.body;
  const sql = `INSERT INTO riwayat_perjalanan (user_id, mulai, tujuan, koordinat_awal, room) VALUES (?, ?, ?, ?, ?)`;
  db.query(sql, [user_id, mulai, tujuan, koordinat, room], (err) => {
    if (err) return res.json({ status: false, error: err.message });
    res.json({ status: true, message: "History saved!" });
  });
});

// ==========================================
// 3. JALANKAN SERVER
// ==========================================
const PORT = process.env.PORT || 8080;
app.listen(PORT, () => console.log(`🚀 Server on port ${PORT}`));

module.exports = app;