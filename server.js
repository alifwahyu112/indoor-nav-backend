process.env.TZ = "Asia/Jakarta"; 

const express = require("express");
const mysql = require("mysql2");
const session = require("express-session");
const path = require("path");
const cors = require("cors");
const bcrypt = require("bcrypt");
const nodemailer = require("nodemailer");
require("dotenv").config();

const MySQLStore = require("express-mysql-session")(session);

const app = express();
const saltRounds = 10;

app.use(cors());
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

app.set("trust proxy", 1);

const useSsl = ['1', 'true', 'yes'].includes((process.env.DB_SSL || '').toLowerCase());
const sslConfig = useSsl ? { minVersion: 'TLSv1.2', rejectUnauthorized: false } : undefined;

const db = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port: Number(process.env.DB_PORT) || 4000,
  ssl: sslConfig,
  waitForConnections: true,
  connectionLimit: 10,
  timezone: '+07:00', 
  dateStrings: true   
});

db.on('connection', function (connection) {
  connection.query("SET time_zone = '+07:00'");
});

const sessionStore = new MySQLStore({}, db);

app.use(
  session({
    secret: process.env.SESSION_SECRET || "secret-key",
    store: sessionStore,
    resave: false,
    saveUninitialized: false,
    cookie: { secure: process.env.NODE_ENV === "production" },
  }),
);

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

const transporter = nodemailer.createTransport({
  host: "smtp.gmail.com",
  port: 465,
  secure: true,
  auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS },
  tls: { rejectUnauthorized: false },
});

app.get("/", (req, res) => {
  if (!req.session.loggedIn) return res.redirect("/login");
  db.query("SELECT * FROM user ORDER BY id DESC", (err, usersResult) => {
    if (err) return res.status(500).send("Database Error");
    res.render("index", { title: "DATA USER", users: usersResult });
  });
});

app.get("/delete-user/:id", (req, res) => {
  if (!req.session.loggedIn) return res.redirect("/login");
  db.query("DELETE FROM user WHERE id = ?", [req.params.id], (err) => {
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
    db.query(sql, [username, hashedPassword, gmail, mobile_number, BPJS_number], (err) => {
      if (err) {
        if (err.code === 'ER_DUP_ENTRY') return res.send("<script>alert('❌ Gagal: Username atau Email sudah terdaftar!'); window.history.back();</script>");
        return res.status(500).send("Gagal menambah user: " + err.message);
      }
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
    }
  );
});

app.get("/forgot-password", (req, res) => res.render("forgot-password", { error: null }));

app.post("/forgot-password", (req, res) => {
  const { email } = req.body; 
  db.query("SELECT * FROM admin WHERE email = ?", [email], async (err, result) => {
      if (err) return res.status(500).render("forgot-password", { error: "Database Error" });
      if (result.length === 0) return res.render("forgot-password", { error: "❌ Email Admin tidak terdaftar!" });

      const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
      req.session.resetEmail = email;
      req.session.resetOTP = otpCode;

      const mailOptions = {
        from: process.env.EMAIL_USER,
        to: email,
        subject: "Kode PIN Verifikasi Reset Password",
        html: `<div style="font-family: sans-serif; padding: 20px;"><h2>Verifikasi Reset Password</h2><p>PIN Anda: <b>${otpCode}</b></p></div>`,
      };

      transporter.sendMail(mailOptions, (error) => {
        if (error) return res.render("forgot-password", { error: `❌ Error: ${error.message}` });
        res.redirect("/verify-otp");
      });
    }
  );
});

app.get("/verify-otp", (req, res) => {
  if (!req.session.resetEmail) return res.redirect("/forgot-password");
  res.render("verify-otp", { error: null });
});

app.post("/verify-otp", (req, res) => {
  const { otp } = req.body;
  if (otp && otp.trim() === req.session.resetOTP) {
    req.session.otpVerified = true;
    res.redirect("/reset-password");
  } else {
    res.render("verify-otp", { error: "❌ Kode PIN salah atau kadaluwarsa!" });
  }
});

app.get("/reset-password", (req, res) => {
  if (!req.session.otpVerified) return res.redirect("/forgot-password");
  res.render("reset-password", { error: null });
});

app.post("/reset-password", async (req, res) => {
  if (!req.session.otpVerified) return res.redirect("/forgot-password");
  const { password, confirmPassword } = req.body;
  if (password !== confirmPassword) return res.render("reset-password", { error: "❌ Konfirmasi password tidak cocok!" });

  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    db.query("UPDATE admin SET password = ? WHERE email = ?", [hashedPassword, req.session.resetEmail], (err) => {
      if (err) return res.status(500).render("reset-password", { error: "Gagal memperbarui database." });
      req.session.destroy(() => res.send("<script>alert('✅ Password diperbarui!'); window.location.href='/login';</script>"));
    });
  } catch (error) {
    res.status(500).render("reset-password", { error: "Error enkripsi password." });
  }
});

// --- RIWAYAT PERJALANAN (INNER JOIN HANYA USER VALID) ---
app.get("/riwayat_perjalanan", (req, res) => {
  if (!req.session.loggedIn) return res.redirect("/login");
  const sql = `
    SELECT r.*, u.gmail, u.id AS id_akun_user 
    FROM riwayat_perjalanan r 
    INNER JOIN user u ON r.user_id = u.username 
    ORDER BY r.tanggal DESC
  `;
  db.query(sql, (err, result) => {
    if (err) return res.status(500).send(err.message);
    res.render("riwayat_perjalanan", { title: "DATA RIWAYAT", riwayat_perjalanans: result });
  });
});

app.post("/tambah-riwayat_perjalanan", (req, res) => {
  const { user_id, mulai, tujuan, koordinat_awal } = req.body;
  const waktuServer = new Date(); 
  db.query("SELECT coordinates FROM map WHERE room_name = ?", [tujuan], (errMap, resultsMap) => {
      let koordinat_tujuan = "-";
      if (!errMap && resultsMap.length > 0) koordinat_tujuan = resultsMap[0].coordinates;
      const sql = `INSERT INTO riwayat_perjalanan (user_id, mulai, tujuan, koordinat_awal, koordinat_tujuan, tanggal, room) VALUES (?, ?, ?, ?, ?, ?, ?)`;
      db.query(sql, [user_id, mulai, tujuan, koordinat_awal, koordinat_tujuan, waktuServer, tujuan], (err) => {
        if (err) return res.status(500).send(err.message);
        res.redirect("/riwayat_perjalanan");
      });
    }
  );
});

app.get("/delete-riwayat_perjalanan/:id", (req, res) => {
  if (!req.session.loggedIn) return res.redirect("/login");
  db.query("DELETE FROM riwayat_perjalanan WHERE id = ?", [req.params.id], (err) => {
      if (err) return res.status(500).send(err.message);
      res.redirect("/riwayat_perjalanan");
    }
  );
});

app.get("/map", (req, res) => {
  if (!req.session.loggedIn) return res.redirect("/login");
  db.query("SELECT * FROM map", (err, mapResult) => {
    if (err) return res.status(500).send("Database Error");
    res.render("map", { title: "DATA MAP", maps: mapResult });
  });
});

app.get("/viewer", (req, res) => {
  if (!req.session.loggedIn) return res.redirect("/login");
  res.render("viewer3d", { title: "BIM 3D Viewer", modelUrl: req.query.model });
});

app.post("/tambah-map", (req, res) => {
  const { Floor_ID, room_name, coordinates_unity, coordinates, room_id, bim_image } = req.body;
  const sql = `INSERT INTO map (Floor_ID, room_name, coordinates_unity, coordinates, room_id, bim_image) VALUES (?, ?, ?, ?, ?, ?)`;
  db.query(sql, [Floor_ID, room_name, coordinates_unity, coordinates || null, room_id, bim_image], (err) => {
    if (err) return res.status(500).send(err.message);
    res.redirect("/map");
  });
});

app.post("/update-map", (req, res) => {
  const { id_map, Floor_ID, room_name, coordinates_unity, coordinates, room_id, bim_image } = req.body;
  const sql = `UPDATE map SET Floor_ID = ?, room_name = ?, coordinates_unity = ?, coordinates = ?, room_id = ?, bim_image = ? WHERE id_map = ?`;
  db.query(sql, [Floor_ID, room_name, coordinates_unity, coordinates || null, room_id, bim_image, id_map], (err) => {
    if (err) return res.status(500).send("Gagal update: " + err.message);
    res.redirect("/map");
  });
});

app.get("/delete-map/:id", (req, res) => {
  if (!req.session.loggedIn) return res.redirect("/login");
  db.query("DELETE FROM map WHERE id_map = ?", [req.params.id], (err) => {
    if (err) return res.status(500).send(err.message);
    res.redirect("/map");
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
  db.query("DELETE FROM admin WHERE id = ?", [req.params.id], (err) => res.redirect("/admin"));
});

app.post("/tambah-admin", async (req, res) => {
  if (!req.session.loggedIn) return res.redirect("/login");
  try {
    const hashedPassword = await bcrypt.hash(req.body.password, 10);
    db.query(`INSERT INTO admin (username, email, password) VALUES (?, ?, ?)`, [req.body.username, req.body.email, hashedPassword], (err) => {
      if (err) return err.code === 'ER_DUP_ENTRY' ? res.send("<script>alert('❌ Gagal: Username/Email sudah terdaftar!'); window.history.back();</script>") : res.status(500).send(err.message);
      res.redirect("/admin");
    });
  } catch (error) { res.status(500).send("Error server"); }
});

app.get("/logout", (req, res) => req.session.destroy(() => res.redirect("/login")));

// ==========================================
// API ENDPOINTS (UNITY CONNECTION)
// ==========================================

app.post("/api/register", async (req, res) => {
  const { username, gmail, password, mobile_number, BPJS_number } = req.body;
  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    db.query(`INSERT INTO user (username, password, gmail, mobile_number, BPJS_number) VALUES (?, ?, ?, ?, ?)`, [username, hashedPassword, gmail, mobile_number, BPJS_number], (err) => {
      if (err) return res.json({ status: false, error: err.code === 'ER_DUP_ENTRY' ? "Username/Email terdaftar!" : err.message });
      res.json({ status: true, message: "Akun Unity berhasil dibuat!" });
    });
  } catch (error) { res.json({ status: false, error: error.message }); }
});

app.post("/api/login", (req, res) => {
  db.query("SELECT * FROM user WHERE gmail = ?", [req.body.email], async (err, result) => {
    if (err || result.length === 0) return res.json({ status: false, message: "User tidak ditemukan" });
    const match = await bcrypt.compare(req.body.password, result[0].password);
    match ? res.json({ status: true, user_id: result[0].id }) : res.json({ status: false, message: "Password salah" });
  });
});

const unityOtpMemory = new Map();

app.post("/api/forgot-password", (req, res) => {
  const email = req.body.email;
  db.query("SELECT * FROM user WHERE gmail = ?", [email], (err, result) => {
    if (err || result.length === 0) return res.json({ status: false, message: "Email tidak terdaftar!" });
    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
    unityOtpMemory.set(email, { otp: otpCode, expires: Date.now() + 300000 });
    transporter.sendMail({ from: process.env.EMAIL_USER, to: email, subject: "Kode OTP Reset Password", text: `OTP Anda: ${otpCode}. Berlaku 5 menit.` }, (error) => {
      error ? res.json({ status: false, message: "Gagal kirim email" }) : res.json({ status: true, message: "OTP berhasil dikirim!" });
    });
  });
});

app.post("/api/reset-password", async (req, res) => {
  const { email, otp, newPassword } = req.body;
  const data = unityOtpMemory.get(email);
  if (!data || data.otp !== otp || Date.now() > data.expires) return res.json({ status: false, message: "Kode OTP salah/kadaluwarsa!" });
  try {
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    db.query("UPDATE user SET password = ? WHERE gmail = ?", [hashedPassword, email], (err) => {
      if (err) return res.json({ status: false, message: "Database error" });
      unityOtpMemory.delete(email); 
      res.json({ status: true, message: "Password berhasil diubah!" });
    });
  } catch (e) { res.json({ status: false, message: "Server error" }); }
});

app.get("/api/get-room-list", (req, res) => {
  db.query("SELECT room_id, room_name FROM map ORDER BY room_name ASC", (err, result) => res.json({ status: !err, data: result }));
});

app.get("/api/map/:id", (req, res) => {
  db.query("SELECT * FROM map WHERE room_id = ?", [req.params.id], (err, result) => {
    if (err || result.length === 0) return res.status(404).json({ status: false });
    res.json(result[0]);
  });
});

app.post("/api/save-history", (req, res) => {
  const { user_id, mulai, tujuan, koordinat_awal } = req.body;
  db.query("SELECT coordinates FROM map WHERE room_name = ?", [tujuan], (errMap, resultsMap) => {
    let koordinat_tujuan_asli = (!errMap && resultsMap.length > 0) ? resultsMap[0].coordinates : "-";
    db.query(`INSERT INTO riwayat_perjalanan (user_id, mulai, tujuan, koordinat_awal, koordinat_tujuan, tanggal, room) VALUES (?, ?, ?, ?, ?, ?, ?)`, 
      [user_id, mulai, tujuan, koordinat_awal, koordinat_tujuan_asli, new Date(), tujuan], (err) => {
      if (err) return res.json({ status: false, error: err.message });
      res.json({ status: true, message: "History saved successfully gles!" });
    });
  });
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => console.log(`🚀 Server on port ${PORT} with WIB Timezone`));

module.exports = app;