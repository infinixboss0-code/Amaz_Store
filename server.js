// Simple Express backend with SQLite storage, JWT auth, product CRUD, tracking, and email notifications
const express = require('express');
const path = require('path');
const fs = require('fs');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const sqlite3 = require('sqlite3').verbose();
const multer = require('multer');
const nodemailer = require('nodemailer');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'change_this_secret';
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'infinixboss0@gmail.com'; // default admin email
const ADMIN_PASS = process.env.ADMIN_PASS || 'ChangeMe123!'; // default password - change after deploy

// db setup
const dbFile = path.join(__dirname, 'data.sqlite');
const dbExists = fs.existsSync(dbFile);
const db = new sqlite3.Database(dbFile);
db.serialize(()=>{
  if(!dbExists){
    db.run(`CREATE TABLE admins (id INTEGER PRIMARY KEY, email TEXT UNIQUE, password TEXT)`);
    db.run(`CREATE TABLE products (asin TEXT PRIMARY KEY, title TEXT, price TEXT, category TEXT, image TEXT)`);
    db.run(`CREATE TABLE clicks (id INTEGER PRIMARY KEY AUTOINCREMENT, asin TEXT, title TEXT, time TEXT, url TEXT, referrer TEXT, userAgent TEXT)`);
    db.run(`CREATE TABLE settings (key TEXT PRIMARY KEY, value TEXT)`);
    const salt = bcrypt.genSaltSync(10);
    const hash = bcrypt.hashSync(ADMIN_PASS, salt);
    db.run('INSERT INTO admins (email,password) VALUES (?,?)', [ADMIN_EMAIL, hash]);
    // seed settings
    db.run('INSERT INTO settings (key,value) VALUES (?,?)', ['affiliateTag','PakSarSeller-20']);
    console.log('Database initialized.');
  }
});

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// serve static
app.use('/assets', express.static(path.join(__dirname, 'assets')));
app.use(express.static(path.join(__dirname, 'public')));

// helper
function authMiddleware(req,res,next){
  const auth = req.headers.authorization;
  if(!auth) return res.status(401).json({message:'Unauthorized'});
  const parts = auth.split(' ');
  if(parts.length!==2) return res.status(401).json({message:'Unauthorized'});
  jwt.verify(parts[1], JWT_SECRET, (err, decoded)=>{
    if(err) return res.status(401).json({message:'Invalid token'});
    req.admin = decoded;
    next();
  });
}

// API: login
app.post('/api/login', (req,res)=>{
  const { email, password } = req.body || {};
  if(!email || !password) return res.status(400).json({message:'Missing'});
  db.get('SELECT * FROM admins WHERE email=?', [email], (err,row)=>{
    if(err) return res.status(500).json({message:'DB error'});
    if(!row) return res.status(401).json({message:'Invalid'});
    const ok = bcrypt.compareSync(password, row.password);
    if(!ok) return res.status(401).json({message:'Invalid'});
    const token = jwt.sign({ id: row.id, email: row.email }, JWT_SECRET, { expiresIn: '12h' });
    res.json({ token });
  });
});

// API: products (GET public)
app.get('/api/products', (req,res)=>{
  db.all('SELECT * FROM products', [], (err, rows)=>{
    if(err) return res.status(500).json({message:'DB error'});
    // affiliate tag for frontend
    db.get('SELECT value FROM settings WHERE key="affiliateTag"', [], (e, r)=>{
      const tag = (r && r.value) ? r.value : 'PakSarSeller-20';
      res.json({ products: rows, affiliateTag: tag });
    });
  });
});

// API: products (CRUD) - protected
app.post('/api/products', authMiddleware, (req,res)=>{
  const { asin, title, price, category, image } = req.body || {};
  if(!asin) return res.status(400).json({message:'Missing ASIN'});
  db.run('INSERT OR REPLACE INTO products (asin,title,price,category,image) VALUES (?,?,?,?,?)', [asin,title,price,category,image], function(err){
    if(err) return res.status(500).json({message:'DB error '+err.message});
    res.json({ok:true});
  });
});

app.get('/api/products/:asin', authMiddleware, (req,res)=>{
  db.get('SELECT * FROM products WHERE asin=?', [req.params.asin], (err,row)=>{
    if(err) return res.status(500).json({}); if(!row) return res.status(404).json({}); res.json(row);
  });
});

app.put('/api/products/:asin', authMiddleware, (req,res)=>{
  const { title, price, category, image } = req.body || {};
  db.run('UPDATE products SET title=?,price=?,category=?,image=? WHERE asin=?', [title,price,category,image,req.params.asin], function(err){
    if(err) return res.status(500).json({message:'DB error'});
    res.json({ok:true});
  });
});

app.delete('/api/products/:asin', authMiddleware, (req,res)=>{
  db.run('DELETE FROM products WHERE asin=?', [req.params.asin], function(err){
    if(err) return res.status(500).json({message:'DB error'});
    res.json({ok:true});
  });
});

// settings
app.get('/api/settings', authMiddleware, (req,res)=>{
  db.all('SELECT key, value FROM settings', [], (err, rows)=>{
    if(err) return res.status(500).json({}); const obj = {}; rows.forEach(r=>obj[r.key]=r.value); res.json(obj);
  });
});
app.post('/api/settings', authMiddleware, (req,res)=>{
  const { affiliateTag, adminEmail } = req.body || {};
  if(affiliateTag) db.run('INSERT OR REPLACE INTO settings (key,value) VALUES (?,?)', ['affiliateTag', affiliateTag]);
  if(adminEmail) db.run('INSERT OR REPLACE INTO settings (key,value) VALUES (?,?)', ['adminEmail', adminEmail]);
  res.json({ok:true});
});

// tracking redirect endpoint: records click and forwards to Amazon
app.get('/r/:asin', (req,res)=>{
  const asin = req.params.asin;
  db.get('SELECT * FROM products WHERE asin=?', [asin], (err, p)=>{
    const now = new Date().toISOString();
    const title = p ? p.title : asin;
    const url = req.originalUrl;
    const ref = req.get('Referer') || null;
    const ua = req.get('User-Agent') || null;
    db.run('INSERT INTO clicks (asin,title,time,url,referrer,userAgent) VALUES (?,?,?,?,?,?)', [asin,title,now,url,ref,ua], function(err2){
      // send email notification (admin)
      db.get('SELECT value FROM settings WHERE key="adminEmail"', [], (e,r)=>{
        const adminEmail = (r&&r.value) ? r.value : process.env.ADMIN_EMAIL || 'infinixboss0@gmail.com';
        // send mail if SMTP config set
        const smtpHost = process.env.SMTP_HOST, smtpPort = process.env.SMTP_PORT, smtpUser = process.env.SMTP_USER, smtpPass = process.env.SMTP_PASS;
        if(smtpHost && smtpUser){
          const transporter = nodemailer.createTransport({ host: smtpHost, port: smtpPort||587, secure:false, auth:{ user: smtpUser, pass: smtpPass } });
          const mail = { from: smtpUser, to: adminEmail, subject: 'New affiliate redirect', text: `ASIN: ${asin}\nTitle: ${title}\nTime: ${now}\nReferrer: ${ref}\nUserAgent: ${ua}` };
          transporter.sendMail(mail, (mailErr, info)=>{ /* ignore errors for now */ });
        }
        // finally redirect to amazon with tag from settings or env
        db.get('SELECT value FROM settings WHERE key="affiliateTag"', [], (ee,rr)=>{
          const tag = (rr&&rr.value) ? rr.value : (process.env.AFFILIATE_TAG || 'PakSarSeller-20');
          const amazonUrl = `https://www.amazon.com/dp/${asin}/?tag=${encodeURIComponent(tag)}`;
          res.redirect(302, amazonUrl);
        });
      });
    });
  });
});

// clicks API (admin)
app.get('/api/clicks', authMiddleware, (req,res)=>{
  db.all('SELECT * FROM clicks ORDER BY id DESC LIMIT 1000', [], (err, rows)=>{ if(err) return res.status(500).json({}); res.json({ clicks: rows }); });
});
app.delete('/api/clicks', authMiddleware, (req,res)=>{
  db.run('DELETE FROM clicks', [], function(err){ if(err) return res.status(500).json({}); res.json({ok:true}); });
});

// admin static route
app.get('/admin', (req,res)=>{ res.sendFile(path.join(__dirname,'public','admin.html')); });

// start server
app.listen(PORT, ()=> console.log('Server listening on', PORT));