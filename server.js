require("dotenv").config();

const express = require("express");
const path = require("path");
const sqlite3 = require("sqlite3").verbose();
const bcrypt = require("bcryptjs");
const cookieParser = require("cookie-parser");
const ExcelJS = require("exceljs");
const nodemailer = require("nodemailer");

const app = express();

app.use(express.json());
app.use(cookieParser(process.env.SESSION_SECRET || "dev_secret"));
app.use(express.static(path.join(__dirname, "public")));

const db = new sqlite3.Database(path.join(__dirname, "bookings.sqlite"));

const PORT = Number(process.env.PORT || 3000);
const PRICE_PER_PERSON = Number(process.env.PRICE_PER_PERSON || 20);

const BUSINESS_NAME = process.env.BUSINESS_NAME || "Horror Factory";
const BUSINESS_ADDRESS =
  process.env.BUSINESS_ADDRESS || "Nobelova 1300/30, 831 02 Bratislava";
const BUSINESS_MAP_URL =
  process.env.BUSINESS_MAP_URL ||
  "https://maps.google.com/?q=Horror+Factory+Nobelova+1300/30+831+02+Bratislava";

const TEST_COUPON = "0277-0277-02D-277";

const SLOTS = [
  { id: "10:00", label: "10:00 – 11:00" },
  { id: "11:30", label: "11:30 – 12:30" },
  { id: "13:00", label: "13:00 – 14:00" },
  { id: "14:30", label: "14:30 – 15:30" },
  { id: "16:00", label: "16:00 – 17:00" },
  { id: "17:30", label: "17:30 – 18:30" },
  { id: "19:00", label: "19:00 – 20:00" },
  { id: "20:30", label: "20:30 – 21:30" }
];
const SLOT_IDS = new Set(SLOTS.map(s => s.id));

function nowISO() {
  return new Date().toISOString();
}

function slotLabel(slotId) {
  const slot = SLOTS.find(s => s.id === slotId);
  return slot ? slot.label : slotId;
}

function validPlayers(n) {
  return Number.isInteger(n) && n >= 2 && n <= 5;
}

function formatDateHuman(dateStr) {
  const d = new Date(dateStr + "T12:00:00");
  return d.toLocaleDateString("sk-SK", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric"
  });
}

function escapeICS(text) {
  return String(text || "")
    .replace(/\\/g, "\\\\")
    .replace(/\n/g, "\\n")
    .replace(/,/g, "\\,")
    .replace(/;/g, "\\;");
}

function createICS(booking) {
  const [year, month, day] = booking.date.split("-").map(Number);
  const [hour, minute] = booking.slot_id.split(":").map(Number);

  const start = new Date(Date.UTC(year, month - 1, day, hour - 1, minute));
  const end = new Date(start.getTime() + 60 * 60 * 1000);

  const fmt = d =>
    d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");

  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Horror Factory//Booking//EN",
    "BEGIN:VEVENT",
    `UID:booking-${booking.id}@horrorfactory.local`,
    `DTSTAMP:${fmt(new Date())}`,
    `DTSTART:${fmt(start)}`,
    `DTEND:${fmt(end)}`,
    `SUMMARY:${escapeICS(`${BUSINESS_NAME} Booking`)}`,
    `DESCRIPTION:${escapeICS(
      `Booking confirmed for ${booking.name}\nPlayers: ${booking.players}\nTime: ${slotLabel(
        booking.slot_id
      )}\nAddress: ${BUSINESS_ADDRESS}\nMap: ${BUSINESS_MAP_URL}`
    )}`,
    `LOCATION:${escapeICS(BUSINESS_ADDRESS)}`,
    "BEGIN:VALARM",
    "TRIGGER:-P1D",
    "ACTION:DISPLAY",
    "DESCRIPTION:Reminder - booking in 24 hours",
    "END:VALARM",
    "BEGIN:VALARM",
    "TRIGGER:-PT2H",
    "ACTION:DISPLAY",
    "DESCRIPTION:Reminder - booking in 2 hours",
    "END:VALARM",
    "END:VEVENT",
    "END:VCALENDAR"
  ].join("\r\n");
}

let transporter = null;
if (process.env.SMTP_USER && process.env.SMTP_PASS) {
  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: false,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS
    }
  });
}

async function sendBookingEmail(booking) {
  if (!transporter) return;

  const html = `
    <div style="font-family:Arial,sans-serif;max-width:640px;margin:0 auto;background:#111;color:#fff;padding:24px;border-radius:18px">
      <h2 style="color:#ff2a2a;margin-top:0">${BUSINESS_NAME} – Booking confirmed</h2>
      <p>Hello ${booking.name}, your reservation is confirmed.</p>
      <table style="width:100%;border-collapse:collapse;margin:16px 0">
        <tr><td style="padding:8px 0;color:#aaa">Date</td><td style="padding:8px 0">${formatDateHuman(booking.date)}</td></tr>
        <tr><td style="padding:8px 0;color:#aaa">Time</td><td style="padding:8px 0">${slotLabel(booking.slot_id)}</td></tr>
        <tr><td style="padding:8px 0;color:#aaa">Players</td><td style="padding:8px 0">${booking.players}</td></tr>
        <tr><td style="padding:8px 0;color:#aaa">Total</td><td style="padding:8px 0">€${booking.price_total_eur}</td></tr>
        <tr><td style="padding:8px 0;color:#aaa">Address</td><td style="padding:8px 0">${BUSINESS_ADDRESS}</td></tr>
      </table>
      <p style="margin:20px 0">
        <a href="${BUSINESS_MAP_URL}" style="display:inline-block;background:#ff2a2a;color:#fff;text-decoration:none;padding:12px 18px;border-radius:12px">Open in Google Maps</a>
      </p>
      <p style="color:#bbb;font-size:13px">If you need to cancel, please contact us directly.</p>
    </div>
  `;

  const ics = createICS(booking);

  await transporter.sendMail({
    from: process.env.SMTP_FROM || process.env.SMTP_USER,
    to: booking.email,
    subject: `${BUSINESS_NAME} – Booking confirmed`,
    html,
    attachments: [
      {
        filename: "horror-factory-booking.ics",
        content: ics,
        contentType: "text/calendar; charset=utf-8; method=REQUEST"
      }
    ]
  });
}

db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS bookings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT NOT NULL,
      phone TEXT NOT NULL,
      players INTEGER NOT NULL,
      date TEXT NOT NULL,
      slot_id TEXT NOT NULL,
      coupon TEXT,
      coupon_status TEXT DEFAULT 'none',
      status TEXT NOT NULL DEFAULT 'CONFIRMED',
      notes TEXT,
      price_total_eur INTEGER DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `);

  db.run(`
    CREATE UNIQUE INDEX IF NOT EXISTS uniq_date_slot
    ON bookings(date, slot_id)
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      pass_hash TEXT NOT NULL,
      role TEXT NOT NULL
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS activity_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      username TEXT,
      role TEXT,
      action TEXT NOT NULL,
      booking_id INTEGER,
      details TEXT,
      created_at TEXT NOT NULL
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS coupons (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT UNIQUE NOT NULL,
      discount_percent INTEGER,
      discount_fixed INTEGER,
      max_uses INTEGER,
      used_count INTEGER DEFAULT 0,
      valid_from TEXT,
      valid_to TEXT,
      active INTEGER DEFAULT 1
    )
  `);

  db.run(
    `INSERT OR IGNORE INTO coupons (code, discount_percent, max_uses, active)
     VALUES ('0277-0277-02D-277', 20, 9999, 1)`
  );

  seedUsers();
});

function seedUsers() {
  const mainUser = process.env.MAIN_USER;
  const mainPass = process.env.MAIN_PASS;
  const staffLine = process.env.STAFF_USERS || "";

  const now = nowISO();

  const ensureUser = (username, password, role) => {
    if (!username || !password) return;

    db.get(`SELECT id FROM users WHERE username=?`, [username], (err, row) => {
      if (row) return;
      const hash = bcrypt.hashSync(password, 10);
      db.run(
        `INSERT INTO users (username, pass_hash, role) VALUES (?,?,?)`,
        [username, hash, role]
      );
      db.run(
        `INSERT INTO activity_log (username, role, action, details, created_at)
         VALUES (?,?,?,?,?)`,
        [username, role, "USER_SEEDED", `Seeded at ${now}`, now]
      );
    });
  };

  ensureUser(mainUser, mainPass, "MAIN");

  staffLine
    .split(",")
    .map(s => s.trim())
    .filter(Boolean)
    .forEach(pair => {
      const [u, p] = pair.split(":").map(x => (x || "").trim());
      ensureUser(u, p, "STAFF");
    });
}

function setSession(res, user) {
  res.cookie(
    "hf_session",
    JSON.stringify({
      id: user.id,
      role: user.role,
      username: user.username
    }),
    {
      signed: true,
      httpOnly: true,
      sameSite: "lax"
    }
  );
}

function getSession(req) {
  const raw = req.signedCookies.hf_session;
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function requireRole(role) {
  return (req, res, next) => {
    const s = getSession(req);
    if (!s) return res.status(401).json({ error: "Not logged in" });
    if (role === "STAFF") return next();
    if (role === "MAIN" && s.role !== "MAIN") {
      return res.status(403).json({ error: "Forbidden" });
    }
    next();
  };
}

function logActivity(req, action, bookingId = null, details = "") {
  const s = getSession(req);
  db.run(
    `INSERT INTO activity_log (user_id, username, role, action, booking_id, details, created_at)
     VALUES (?,?,?,?,?,?,?)`,
    [
      s?.id || null,
      s?.username || null,
      s?.role || null,
      action,
      bookingId,
      details,
      nowISO()
    ]
  );
}

function validateCouponInline(code) {
  if (!code) return { valid: false, status: "none", discountPercent: 0, discountFixed: 0 };
  const clean = String(code).trim();

  return new Promise((resolve, reject) => {
    db.get(
      `SELECT * FROM coupons WHERE code=? AND active=1`,
      [clean],
      (err, coupon) => {
        if (err) return reject(err);
        if (!coupon) {
          return resolve({
            valid: false,
            status: "invalid",
            discountPercent: 0,
            discountFixed: 0
          });
        }

        const now = new Date();

        if (coupon.valid_to && new Date(coupon.valid_to) < now) {
          return resolve({
            valid: false,
            status: "expired",
            discountPercent: 0,
            discountFixed: 0
          });
        }

        if (coupon.max_uses && coupon.used_count >= coupon.max_uses) {
          return resolve({
            valid: false,
            status: "limit_reached",
            discountPercent: 0,
            discountFixed: 0
          });
        }

        resolve({
          valid: true,
          status: "valid",
          discountPercent: coupon.discount_percent || 0,
          discountFixed: coupon.discount_fixed || 0
        });
      }
    );
  });
}

app.get("/api/config", (req, res) => {
  res.json({
    businessName: BUSINESS_NAME,
    businessAddress: BUSINESS_ADDRESS,
    businessMapUrl: BUSINESS_MAP_URL,
    pricePerPerson: PRICE_PER_PERSON,
    slots: SLOTS
  });
});

app.get("/api/availability", (req, res) => {
  const { date } = req.query;
  if (!date) return res.status(400).json({ error: "Missing date" });

  db.all(
    `SELECT slot_id FROM bookings WHERE date=? AND status IN ('CONFIRMED','PAID')`,
    [date],
    (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ booked: rows.map(r => r.slot_id) });
    }
  );
});

app.post("/api/coupon/verify", async (req, res) => {
  try {
    const { code, players } = req.body || {};
    const p = Number(players || 0);
    const baseTotal = p > 0 ? p * PRICE_PER_PERSON : 0;

    const result = await validateCouponInline(code);

    let finalTotal = baseTotal;
    if (result.valid) {
      if (result.discountPercent > 0) {
        finalTotal -= Math.round((finalTotal * result.discountPercent) / 100);
      }
      if (result.discountFixed > 0) {
        finalTotal -= result.discountFixed;
      }
      if (finalTotal < 0) finalTotal = 0;
    }

    res.json({
      valid: result.valid,
      status: result.status,
      discountPercent: result.discountPercent,
      discountFixed: result.discountFixed,
      baseTotal,
      finalTotal
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/book", async (req, res) => {
  try {
    const { name, email, phone, players, date, slot_id, notes, coupon } = req.body || {};

    if (!name || !email || !phone || !players || !date || !slot_id) {
      return res.status(400).json({ error: "All required fields must be filled." });
    }

    const p = Number(players);
    if (!validPlayers(p)) {
      return res.status(400).json({ error: "Players must be between 2 and 5." });
    }

    if (!SLOT_IDS.has(slot_id)) {
      return res.status(400).json({ error: "Invalid time slot." });
    }

    db.get(
      `SELECT id FROM bookings WHERE date=? AND slot_id=? AND status IN ('CONFIRMED','PAID')`,
      [date, slot_id],
      async (err, row) => {
        if (err) return res.status(500).json({ error: err.message });
        if (row) {
          return res.status(400).json({ error: "This time is already booked." });
        }

        const couponResult = await validateCouponInline(coupon);
        let total = p * PRICE_PER_PERSON;

        if (couponResult.valid) {
          if (couponResult.discountPercent > 0) {
            total -= Math.round((total * couponResult.discountPercent) / 100);
          }
          if (couponResult.discountFixed > 0) {
            total -= couponResult.discountFixed;
          }
          if (total < 0) total = 0;
        }

        const created = nowISO();

        db.run(
          `INSERT INTO bookings
            (name,email,phone,players,date,slot_id,coupon,coupon_status,status,notes,price_total_eur,created_at,updated_at)
           VALUES (?,?,?,?,?,?,?,?, 'CONFIRMED', ?, ?, ?, ?)`,
          [
            name,
            email,
            phone,
            p,
            date,
            slot_id,
            coupon || "",
            couponResult.status,
            notes || "",
            total,
            created,
            created
          ],
          async function (err2) {
            if (err2) return res.status(500).json({ error: err2.message });

            const bookingId = this.lastID;

            if (coupon && couponResult.valid) {
              db.run(
                `UPDATE coupons SET used_count = used_count + 1 WHERE code=?`,
                [coupon]
              );
            }

            db.get(`SELECT * FROM bookings WHERE id=?`, [bookingId], async (err3, booking) => {
              if (!err3 && booking) {
                try {
                  await sendBookingEmail({
                    ...booking,
                    id: bookingId
                  });
                } catch (mailErr) {
                  console.error("Email send failed:", mailErr.message);
                }
              }

              res.json({
                success: true,
                booking_id: bookingId
              });
            });
          }
        );
      }
    );
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/booking/:id", (req, res) => {
  db.get(`SELECT * FROM bookings WHERE id=?`, [req.params.id], (err, row) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!row) return res.status(404).json({ error: "Booking not found" });

    res.json({
      ...row,
      slotLabel: slotLabel(row.slot_id),
      address: BUSINESS_ADDRESS,
      mapUrl: BUSINESS_MAP_URL
    });
  });
});

app.post("/api/admin/login", (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) {
    return res.status(400).json({ error: "Missing credentials" });
  }

  db.get(`SELECT * FROM users WHERE username=?`, [username], (err, user) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!user) return res.status(401).json({ error: "Invalid credentials" });

    const ok = bcrypt.compareSync(password, user.pass_hash);
    if (!ok) return res.status(401).json({ error: "Invalid credentials" });

    setSession(res, user);

    db.run(
      `INSERT INTO activity_log (user_id, username, role, action, details, created_at)
       VALUES (?,?,?,?,?,?)`,
      [user.id, user.username, user.role, "LOGIN", "Login success", nowISO()]
    );

    res.json({ success: true, role: user.role });
  });
});

app.post("/api/admin/logout", (req, res) => {
  res.clearCookie("hf_session");
  res.json({ success: true });
});

app.get("/api/admin/me", requireRole("STAFF"), (req, res) => {
  const s = getSession(req);
  if (!s) return res.status(401).json({ error: "Not logged in" });

  res.json({
    username: s.username,
    role: s.role
  });
});

app.get("/api/admin/bookings", requireRole("STAFF"), (req, res) => {
  const { q, date } = req.query;

  let where = `WHERE 1=1`;
  const params = [];

  if (date) {
    where += ` AND date=?`;
    params.push(date);
  }

  if (q) {
    where += ` AND (name LIKE ? OR email LIKE ? OR phone LIKE ? OR coupon LIKE ?)`;
    params.push(`%${q}%`, `%${q}%`, `%${q}%`, `%${q}%`);
  }

  db.all(
    `SELECT * FROM bookings ${where} ORDER BY date DESC, slot_id DESC, id DESC LIMIT 1000`,
    params,
    (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json(rows);
    }
  );
});

app.post("/api/admin/cancel", requireRole("STAFF"), (req, res) => {
  const { id } = req.body || {};
  if (!id) return res.status(400).json({ error: "Missing id" });

  db.run(
    `UPDATE bookings SET status='CANCELLED', updated_at=? WHERE id=?`,
    [nowISO(), id],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });
      logActivity(req, "CANCEL_BOOKING", id, "Status=CANCELLED");
      res.json({ success: true });
    }
  );
});

app.post("/api/admin/move", requireRole("STAFF"), (req, res) => {
  const { id, newDate, newSlot } = req.body || {};
  if (!id || !newDate || !newSlot) {
    return res.status(400).json({ error: "Missing fields" });
  }
  if (!SLOT_IDS.has(newSlot)) {
    return res.status(400).json({ error: "Invalid slot" });
  }

  db.get(
    `SELECT id FROM bookings WHERE date=? AND slot_id=? AND status IN ('CONFIRMED','PAID')`,
    [newDate, newSlot],
    (err, row) => {
      if (err) return res.status(500).json({ error: err.message });
      if (row) {
        return res.status(400).json({ error: "Target slot already booked." });
      }

      db.run(
        `UPDATE bookings SET date=?, slot_id=?, updated_at=? WHERE id=?`,
        [newDate, newSlot, nowISO(), id],
        function (err2) {
          if (err2) return res.status(500).json({ error: err2.message });
          logActivity(req, "MOVE_BOOKING", id, `Moved to ${newDate} ${newSlot}`);
          res.json({ success: true });
        }
      );
    }
  );
});

app.post("/api/admin/paid", requireRole("STAFF"), (req, res) => {
  const { id } = req.body || {};
  if (!id) return res.status(400).json({ error: "Missing id" });

  db.run(
    `UPDATE bookings SET status='PAID', updated_at=? WHERE id=?`,
    [nowISO(), id],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });
      logActivity(req, "MARK_PAID", id, "Status=PAID");
      res.json({ success: true });
    }
  );
});

app.post("/api/admin/delete", requireRole("MAIN"), (req, res) => {
  const { id } = req.body || {};
  if (!id) return res.status(400).json({ error: "Missing id" });

  db.run(`DELETE FROM bookings WHERE id=?`, [id], function (err) {
    if (err) return res.status(500).json({ error: err.message });
    logActivity(req, "DELETE_PERMANENT", id, "Row deleted");
    res.json({ success: true });
  });
});

app.get("/api/admin/export.xlsx", requireRole("STAFF"), async (req, res) => {
  const { date } = req.query;

  let where = `WHERE 1=1`;
  const params = [];
  if (date) {
    where += ` AND date=?`;
    params.push(date);
  }

  db.all(
    `SELECT * FROM bookings ${where} ORDER BY date DESC, slot_id DESC, id DESC`,
    params,
    async (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });

      const wb = new ExcelJS.Workbook();
      const ws = wb.addWorksheet("Bookings");

      ws.columns = [
        { header: "ID", key: "id", width: 8 },
        { header: "Date", key: "date", width: 12 },
        { header: "Slot", key: "slot_id", width: 12 },
        { header: "Status", key: "status", width: 12 },
        { header: "Name", key: "name", width: 20 },
        { header: "Phone", key: "phone", width: 16 },
        { header: "Email", key: "email", width: 26 },
        { header: "Players", key: "players", width: 10 },
        { header: "Coupon", key: "coupon", width: 18 },
        { header: "Coupon Status", key: "coupon_status", width: 16 },
        { header: "Notes", key: "notes", width: 28 },
        { header: "Price", key: "price_total_eur", width: 10 },
        { header: "Created", key: "created_at", width: 22 }
      ];

      rows.forEach(r => ws.addRow(r));

      res.setHeader(
        "Content-Type",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      );
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="bookings.xlsx"`
      );

      await wb.xlsx.write(res);
      res.end();

      logActivity(req, "EXPORT_EXCEL", null, date ? `Export for ${date}` : "Export all");
    }
  );
});

app.get("/api/admin/activity", requireRole("MAIN"), (req, res) => {
  db.all(
    `SELECT * FROM activity_log ORDER BY id DESC LIMIT 1000`,
    (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json(rows);
    }
  );
});

app.get("/api/admin/reminders", requireRole("STAFF"), (req, res) => {
  const now = new Date();
  const today = now.toISOString().slice(0, 10);

  db.all(
    `SELECT * FROM bookings WHERE date=? AND status IN ('CONFIRMED','PAID') ORDER BY slot_id ASC`,
    [today],
    (err, todayRows) => {
      if (err) return res.status(500).json({ error: err.message });

      db.get(
        `SELECT * FROM bookings
         WHERE (date > ? OR (date = ? AND slot_id >= ?))
         AND status IN ('CONFIRMED','PAID')
         ORDER BY date ASC, slot_id ASC
         LIMIT 1`,
        [today, today, now.toTimeString().slice(0, 5)],
        (err2, nextRow) => {
          if (err2) return res.status(500).json({ error: err2.message });

          res.json({
            todaysGroups: todayRows,
            nextUpcoming: nextRow || null
          });
        }
      );
    }
  );
});

app.listen(PORT, () => {
  console.log(`Booking: http://localhost:${PORT}/`);
  console.log(`Admin login: http://localhost:${PORT}/admin-login.html`);
});