const express = require("express");
const mysql = require("mysql2");
const session = require("express-session");
const path = require("path");
const cors = require('cors');
const bcrypt = require('bcrypt'); 
const nodemailer = require("nodemailer"); 
require('dotenv').config();

const MySQLStore = require('express-mysql-session')(session);

const app = express();
const saltRounds = 10; 

app.use(cors());
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

app.set('trust proxy', 1); 

app.use(session({
  secret: process.env.SESSION_SECRET || "secret-key",
  resave: false,
  saveUninitialized: true,
  cookie: { secure: process.env.NODE_ENV === 'production' } 
}));

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

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

const transporter = nodemailer.createTransport({
  host: "smtp.gmail.com",
  port: 465,
  secure: true, 
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS  
  },
  tls: {
    rejectUnauthorized: false 
  }
});

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

// --- LOGIN ADMIN ---
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

// Halaman 1: Minta PIN OTP (Tampilan Input Email)
app.get("/forgot-password", (req, res) => {
  res.render("forgot-password", { error: null });
});

// Proses Pengecekan Username & Email Admin untuk Kirim Kode PIN 
app.post("/forgot-password", (req, res) => { // <-- FIXED TYPO (Ditambahkan 'app.')
  const { username, email } = req.body;

  db.query("SELECT * FROM admin WHERE username = ? AND email = ?", [username, email], async (err, result) => {
    if (err) return res.status(500).render("forgot-password", { error: "Database Error" });
    
    if (result.length === 0) {
      return res.render("forgot-password", { error: "❌ Kombinasi Username dan Email Admin tidak cocok atau tidak terdaftar!" });
    }

    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
    
    req.session.resetEmail = email;
    req.session.resetOTP = otpCode;

    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: email,
      subject: "Kode PIN Verifikasi Reset Password Admin",
      html: `
        <div style="font-family: sans-serif; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px; max-w: 500px;">
          <h2 style="color: #2563eb;">Verifikasi Reset Password</h2>
          <p>Halo <b>${username}</b>, Anda menerima email ini karena ada permintaan pemulihan kata sandi akun dashboard.</p>
          <p>Berikut adalah 6 digit PIN verifikasi Anda:</p>
          <div style="background-color: #f8fafc; border: 1px dashed #cbd5e1; padding: 12px; text-align: center; font-size: 24px; font-weight: bold; letter-spacing: 4px; color: #1e293b; font-family: monospace;">
            ${otpCode}
          </div>
          <p style="font-size: 12px; color: #64748b; margin-top: 20px;">*Jangan berikan kode PIN ini kepada siapapun. Jika Anda tidak merasa melakukan request ini, silakan abaikan email ini.</p>
        </div>
      `
    };

    transporter.sendMail(mailOptions, (error, info) => {
      if (error) {
        console.error("Error Nodemailer Terdeteksi:", error);
        return res.render("forgot-password", { 
          error: `❌ Detail Error Google: ${error.message}` 
        });
      }
      res.redirect("/verify-otp");
    });
  });
});

// Halaman 2: Input Verifikasi PIN OTP
app.get("/verify-otp", (req, res) => {
  if (!req.session.resetEmail) return res.redirect("/forgot-password");
  res.render("verify-otp", { error: null });
});

// Proses Validasi Angka PIN OTP
app.post("/verify-otp", (req, res) => {
  const { otp } = req.body;

  if (otp && otp.trim() === req.session.resetOTP) {
    req.session.otpVerified = true; 
    res.redirect("/reset-password");
  } else {
    res.render("verify-otp", { error: "❌ Kode PIN salah atau kadaluwarsa! Periksa kembali email Anda." });
  }
});

// Halaman 3: Form Pembuatan Password Baru
app.get("/reset-password", (req, res) => {
  if (!req.session.otpVerified) return res.redirect("/forgot-password");
  res.render("reset-password", { error: null });
});

// Proses Update Password Baru ke Database TiDB
app.post("/reset-password", async (req, res) => {
  if (!req.session.otpVerified) return res.redirect("/forgot-password");
  const { password, confirmPassword } = req.body;

  if (password !== confirmPassword) {
    return res.render("reset-password", { error: "❌ Konfirmasi password tidak cocok!" });
  }

  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    const sql = "UPDATE admin SET password = ? WHERE email = ?";

    db.query(sql, [hashedPassword, req.session.resetEmail], (err) => {
      if (err) return res.status(500).render("reset-password", { error: "Gagal memperbarui database." });
      
      req.session.destroy(() => {
        res.send("<script>alert('✅ Password admin berhasil diperbarui! Silakan login kembali.'); window.location.href='/login';</script>");
      });
    });
  } catch (error) {
    res.status(500).render("reset-password", { error: "Error enkripsi password." });
  }
});

// --- RIWAYAT PERJALANAN ---
app.get("/riwayat_perjalanan", (req, res) => {
  if (!req.session.loggedIn) return res.redirect("/login");
  db.query("SELECT * FROM riwayat_perjalanan ORDER BY tanggal DESC", (err, result) => {
    if (err) return res.status(500).send(err.message);
    res.render("riwayat_perjalanan", { title: "DATA RIWAYAT", riwayat_perjalanans: result });
  });
});

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

// --- MAP ---
app.get("/map", (req, res) => {
  if (!req.session.loggedIn) return res.redirect("/login");
  db.query("SELECT * FROM map", (err, mapResult) => {
    if (err) return res.status(500).send("Database Error");
    res.render("map", { title: "DATA MAP", maps: mapResult });
  });
});

// 1. TAMBAH MAP (Termasuk kolom bim_image)
app.post("/tambah-map", (req, res) => {
  const { Floor_ID, room_name, coordinates, room_id, bim_image } = req.body; // <-- TAMBAH VARIABEL
  const sql = `INSERT INTO map (Floor_ID, room_name, coordinates, room_id, bim_image) VALUES (?, ?, ?, ?, ?)`; // <-- UPDATE QUERY
  db.query(sql, [Floor_ID, room_name, coordinates, room_id, bim_image], err => { // <-- TAMBAH PARAMETER
    if (err) return res.status(500).send(err.message);
    res.redirect("/map");
  });
});

// 2. UPDATE MAP (Termasuk kolom bim_image)
app.post("/update-map", (req, res) => {
  const { id_map, Floor_ID, room_name, coordinates, room_id, bim_image } = req.body; // <-- TAMBAH VARIABEL
  const sql = `UPDATE map SET Floor_ID = ?, room_name = ?, coordinates = ?, room_id = ?, bim_image = ? WHERE id_map = ?`; // <-- UPDATE QUERY
  db.query(sql, [Floor_ID, room_name, coordinates, room_id, bim_image, id_map], err => { // <-- TAMBAH PARAMETER
    if (err) return res.status(500).send("Gagal update: " + err.message);
    res.redirect("/map");
  });
});

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
  const { username, email, password } = req.body; 
  
  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    const sql = `INSERT INTO admin (username, email, password) VALUES (?, ?, ?)`;

    db.query(sql, [username, email, hashedPassword], err => {
      if (err) {
        console.error("Error SQL Tambah Admin:", err.message);
        return res.status(500).send("Gagal menambah admin: " + err.message);
      }
      res.redirect("/admin");
    });
  } catch (error) {
    res.status(500).send("Error saat melakukan enkripsi password");
  }
});

app.get("/logout", (req, res) => {
  req.session.destroy(() => res.redirect("/login"));
});

// ==========================================
// 2. API ENDPOINTS (YANG DICARI UNITY)
// ==========================================

app.post("/api/register", async (req, res) => {
  const { username, gmail, password, mobile_number, BPJS_number } = req.body;
  console.log("Data API Register yang diterima:", req.body);

  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    const sql = `INSERT INTO user (username, password, gmail, mobile_number, BPJS_number) VALUES (?, ?, ?, ?, ?)`;
    
    db.query(sql, [username, hashedPassword, gmail, mobile_number, BPJS_number], err => {
      if (err) {
        console.error("Error SQL API:", err.message);
        return res.json({ status: false, error: err.message });
      }

      res.json({ status: true, message: "Akun Unity berhasil dibuat!" });
    });
  } catch (error) {
    res.json({ status: false, error: "Error server: " + error.message });
  }
});

app.post("/api/login", (req, res) => {
    const { email, password } = req.body;
    db.query("SELECT * FROM user WHERE gmail = ?", [email], async (err, result) => {
        if (err || result.length === 0) return res.json({ status: false, message: "User tidak ditemukan" });
        const match = await bcrypt.compare(password, result[0].password);
        if (match) {
            res.json({ status: true, user_id: result[0].id });
        } else {
            res.json({ status: false, message: "Password salah" });
        }
    });
});

app.get("/api/get-room-list", (req, res) => {
  db.query("SELECT room_id, room_name FROM map ORDER BY room_name ASC", (err, result) => {
    if (err) return res.json({ status: false });
    res.json({ status: true, data: result });
  });
});

// 3. API DETAIL MAP (Otomatis mengirim data bim_image ke Unity karena memakai SELECT *)
app.get("/api/map/:id", (req, res) => {
  db.query("SELECT * FROM map WHERE room_id = ?", [req.params.id], (err, result) => {
    if (err || result.length === 0) return res.status(404).json({ status: false });
    res.json(result[0]);
  });
});

app.post("/api/save-history", (req, res) => {
 
  const { user_id, mulai, tujuan, koordinat_awal } = req.body;
  const tanggalSekarang = new Date();
  const sql = `INSERT INTO riwayat_perjalanan (user_id, mulai, tujuan, koordinat_awal, tanggal) VALUES (?, ?, ?, ?, ?)`;
  
  db.query(sql, [user_id, mulai, tujuan, koordinat_awal, tanggalSekarang], (err) => {
    if (err) {
      console.error("❌ SQL Error Simpan Riwayat:", err.message);
      return res.json({ status: false, error: err.message });
    }
    res.json({ status: true, message: "History saved successfully gles!" });
  });
});

// ==========================================
// 3. JALANKAN SERVER
// ==========================================
const PORT = process.env.PORT || 8080;
app.listen(PORT, () => console.log(`🚀 Server on port ${PORT}`));

module.exports = app;