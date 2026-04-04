const express = require("express");
const mysql = require("mysql2");
const session = require("express-session");
const path = require("path");
const cors = require('cors');
require('dotenv').config();

const app = express();

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

// ===== Koneksi Database (PERUBAHAN 1: Pakai POOL untuk Vercel Serverless) =====
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
  // Setting tambahan untuk pool
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

// PERUBAHAN 2: Cek koneksi pakai getConnection, bukan db.connect() yang bikin hang
db.getConnection((err, connection) => {
  if (err) {
    console.error("❌ Gagal koneksi ke database:", err.message);
  } else {
    console.log("✅ Connected to database pool...");
    connection.release(); // lepaskan koneksi agar bisa dipakai lagi
  }
});

// ===== Login Page =====
app.get("/login", (req, res) => {
  res.render("login", { title: "Login Admin" });
});

// ===== Proses Login (ADMIN) - TANPA HASH =====
app.post("/login", (req, res) => {
  const { username, password } = req.body;

  db.query(
    "SELECT * FROM admin WHERE username = ?",
    [username],
    (err, result) => {
      if (err) return res.status(500).send("Database Error"); // Handle error agar tidak mati

      if (result.length === 0) {
        return res.send("❌ Login gagal! Username tidak ditemukan.");
      }

      const admin = result[0];

      if (password === admin.password) {
        req.session.loggedIn = true;
        req.session.username = username;
        res.redirect("/");
      } else {
        res.send("❌ Login gagal! Password salah.");
      }
    }
  );
});

// ===== Halaman Utama (Data User) =====
app.get("/", (req, res) => {
  if (!req.session.loggedIn) return res.redirect("/login");

  db.query("SELECT * FROM user", (err, usersResult) => {
    if (err) return res.status(500).send("Database Error");
    res.render("index", {
      title: "DATA USER",
      users: usersResult
    });
  });
});

// ===== Tambah User - TANPA HASH =====
app.post("/tambah", (req, res) => {
  const { username, password, gmail, mobile_number, BPJS_number } = req.body;
  const sql = `
      INSERT INTO user (username, password, gmail, mobile_number, BPJS_number)
      VALUES (?, ?, ?, ?, ?)
    `;
  
  db.query(sql, [username, password, gmail, mobile_number, BPJS_number], err => {
    if (err) return res.status(500).send("Database Error");
    res.redirect("/");
  });
});

// ===== Hapus User =====
app.get("/delete-user/:id", (req, res) => {
  if (!req.session.loggedIn) return res.redirect("/login");

  const id = req.params.id;
  db.query("DELETE FROM user WHERE id = ?", [id], err => {
    if (err) return res.status(500).send("Database Error");
    res.redirect("/");
  });
});

// ===== Halaman MAP =====
app.get("/map", (req, res) => {
  if (!req.session.loggedIn) return res.redirect("/login");

  db.query("SELECT * FROM map", (err, mapResult) => {
    if (err) return res.status(500).send("Database Error");
    res.render("map", {
      title: "DATA MAP",
      maps: mapResult
    });
  });
});

// ===== Tambah MAP =====
app.post("/tambah-map", (req, res) => {
  const { Floor_ID, room_name, coordinates, room_id } = req.body;
  const sql = `
    INSERT INTO map (Floor_ID, room_name, coordinates, room_id)
    VALUES (?, ?, ?, ?)
  `;
  db.query(sql, [Floor_ID, room_name, coordinates, room_id], err => {
    if (err) return res.status(500).send("Database Error");
    res.redirect("/map");
  });
});

// ===== Update MAP =====
app.post("/update-map", (req, res) => {
  const { id_map, Floor_ID, room_name, coordinates, room_id } = req.body;
  const sql = `
    UPDATE map 
    SET Floor_ID = ?, room_name = ?, coordinates = ?, room_id = ? 
    WHERE id_map = ?
  `;
  db.query(sql, [Floor_ID, room_name, coordinates, room_id, id_map], err => {
    if (err) return res.status(500).send("Database Error");
    res.redirect("/map");
  });
});

// ===== Hapus MAP =====
app.get("/delete-map/:id", (req, res) => {
  if (!req.session.loggedIn) return res.redirect("/login");

  const id = req.params.id;
  db.query("DELETE FROM map WHERE id_map = ?", [id], err => {
    if (err) return res.status(500).send("Database Error");
    res.redirect("/map");
  });
});

// ===== Halaman iNav =====
app.get("/inav", (req, res) => {
  if (!req.session.loggedIn) return res.redirect("/login");

  db.query("SELECT * FROM inav", (err, inavResult) => {
    if (err) return res.status(500).send("Database Error");
    res.render("inav", {
      title: "DATA INAV",
      inavs: inavResult
    });
  });
});

// ===== Tambah iNav =====
app.post("/tambah-inav", (req, res) => {
  const { starting_position, target, history } = req.body;
  const sql = `
    INSERT INTO inav (starting_position, target, history)
    VALUES (?, ?, ?)
  `;
  db.query(sql, [starting_position, target, history], err => {
    if (err) return res.status(500).send("Database Error");
    res.redirect("/inav");
  });
});

// ===== Hapus iNav =====
app.get("/delete-inav/:id", (req, res) => {
  if (!req.session.loggedIn) return res.redirect("/login");

  const id = req.params.id;
  db.query("DELETE FROM inav WHERE id = ?", [id], err => {
    if (err) return res.status(500).send("Database Error");
    res.redirect("/inav");
  });
});

// ===== Halaman Admin =====
app.get("/admin", (req, res) => {
  if (!req.session.loggedIn) return res.redirect("/login");

  db.query("SELECT * FROM admin", (err, adminResult) => {
    if (err) return res.status(500).send("Database Error");
    res.render("admin", {
      title: "DATA ADMIN",
      admins: adminResult
    });
  });
});

// ===== Tambah Admin - TANPA HASH =====
app.post("/tambah-admin", (req, res) => {
  const { username, password } = req.body;
  const sql = "INSERT INTO admin (username, password) VALUES (?, ?)";
  db.query(sql, [username, password], err => {
    if (err) return res.status(500).send("Database Error");
    res.redirect("/admin");
  });
});

// ===== Hapus Admin =====
app.get("/delete-admin/:id", (req, res) => {
  if (!req.session.loggedIn) return res.redirect("/login");

  const id = req.params.id;
  db.query("DELETE FROM admin WHERE id = ?", [id], err => {
    if (err) return res.status(500).send("Database Error");
    res.redirect("/admin");
  });
});

// ===== Logout =====
app.get("/logout", (req, res) => {
  req.session.destroy(err => {
    if (err) console.error(err);
    res.redirect("/login");
  });
});

// ==========================================
// API ENDPOINTS (Untuk Mobile/Unity)
// ==========================================

app.post("/api/login", (req, res) => {
    const { username, password } = req.body;
    db.query("SELECT * FROM user WHERE username = ?", [username], (err, result) => {
        if (err) return res.json({ status: false, message: "Server Error" });
        if (result.length === 0) return res.json({ status: false, message: "User tidak ditemukan" });

        const user = result[0];
        if (password === user.password) {
            res.json({ 
                status: true, 
                message: "Login Berhasil", 
                username: user.username,
                id: user.id 
            });
        } else {
            res.json({ status: false, message: "Password Salah" });
        }
    });
});

app.get("/api/get-map-data", (req, res) => {
    db.query("SELECT * FROM map", (err, result) => {
        if (err) return res.json({ status: false, message: "Gagal mengambil data map" });
        res.json({ status: true, data: result });
    });
});

app.post("/api/scan-qr", (req, res) => {
    const { code } = req.body; 
    if (!code) return res.json({ status: false, message: "Data QR Code kosong!" });

    const query = "SELECT * FROM map WHERE room_id = ?";
    db.query(query, [code], (err, result) => {
        if (err) return res.json({ status: false, message: "Server Error" });
        if (result.length === 0) {
            return res.json({ 
                status: false, 
                message: "QR Code tidak dikenali (Room ID salah)." 
            });
        }

        const dataLokasi = result[0];
        res.json({
            status: true,
            message: "Lokasi Ditemukan!",
            data: {
                room_name: dataLokasi.room_name,
                coordinates: dataLokasi.coordinates, 
                floor_id: dataLokasi.Floor_ID
            }
        });
    });
});

app.get("/api/get-inav-data", (req, res) => {
    db.query("SELECT * FROM inav", (err, result) => {
        if (err) return res.json({ status: false, message: "Gagal mengambil data inav" });
        res.json({ status: true, data: result });
    });
});

app.get("/api/get-user-data", (req, res) => {
    db.query("SELECT * FROM user", (err, result) => {
        if (err) return res.json({ status: false, message: "Gagal mengambil data user" });
        res.json({ status: true, data: result });
    });
});

app.get("/api/map/:id", (req, res) => {
    const roomId = req.params.id; 
    const sql = "SELECT * FROM map WHERE room_id = ?";
    db.query(sql, [roomId], (err, result) => {
        if (err) return res.status(500).json({ error: "Database Error" });
        if (result.length === 0) return res.status(404).json({ message: "Room ID Not Found" });

        const data = result[0];
        res.json({
            room_id: data.room_id,      
            coordinates: data.coordinates,
            room_name: data.room_name,
            Floor_ID: data.Floor_ID 
        });
    });
});

app.get("/api/get-room-list", (req, res) => {
    const sql = "SELECT room_id, room_name FROM map";
    db.query(sql, (err, result) => {
        if (err) return res.json({ status: false, message: "Gagal mengambil daftar ruangan" });
        res.json({ status: true, data: result });
    });
});

// ===== PERUBAHAN 3: CARA JALAN SERVER ======
// Jika di laptop sendiri (lokal), kita pakai app.listen
if (process.env.NODE_ENV !== 'production') {
  const PORT = process.env.PORT || 8000;
  const HOST = process.env.HOST || "0.0.0.0";
  app.listen(PORT, HOST, () => {
    console.log(`🚀 Server running on http://127.0.0.1:${PORT}`);
  });
}

// JIKA DI VERCEL: Wajib diexport, Vercel yang akan mengatur Listen-nya secara otomatis!
module.exports = app;