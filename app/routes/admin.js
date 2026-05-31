const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { requireAdmin } = require('../middleware/auth');
const { getCatches, getCatch, insertCatch, updateCatch, deleteCatch,
        getEvents, getEvent, insertEvent, updateEvent, deleteEvent,
        getRsvpsForEvent } = require('../db');

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = process.env.UPLOAD_DIR || path.join(__dirname, '..', 'uploads');
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`);
  }
});
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const upload = multer({
  storage,
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only JPEG, PNG, WebP, and GIF images are allowed'));
    }
  }
});

// Auth
router.get('/login', (req, res) => res.render('admin/login', { error: null }));

router.post('/login', async (req, res) => {
  try {
    const hash = process.env.ADMIN_PASSWORD_HASH || '';
    const match = await bcrypt.compare(req.body.password || '', hash);
    if (!match) return res.status(401).render('admin/login', { error: 'Invalid password' });
    req.session.isAdmin = true;
    res.redirect('/admin');
  } catch (err) {
    res.status(500).render('admin/login', { error: 'Server error during login' });
  }
});

router.get('/logout', (req, res) => {
  req.session.destroy(() => res.redirect('/admin/login'));
});

// Dashboard
router.get('/', requireAdmin, (req, res) => {
  const db = req.app.locals.db;
  res.render('admin/dashboard', { catches: getCatches(db), events: getEvents(db) });
});

// Catches
router.get('/catches/new', requireAdmin, (req, res) => {
  res.render('admin/catch-form', { catchRow: null, action: '/admin/catches' });
});

router.post('/catches', requireAdmin, upload.single('photo'), (req, res) => {
  const db = req.app.locals.db;
  const photo_path = req.file ? req.file.filename : 'placeholder.jpg';
  insertCatch(db, {
    photo_path,
    species: req.body.species,
    location_name: req.body.location_name,
    lat: req.body.lat ? parseFloat(req.body.lat) : null,
    lng: req.body.lng ? parseFloat(req.body.lng) : null,
    caught_at: req.body.caught_at,
    weight_oz: req.body.weight_oz ? parseInt(req.body.weight_oz) : null,
    length_in: req.body.length_in ? parseInt(req.body.length_in) : null,
    notes: req.body.notes || null
  });
  res.redirect('/admin');
});

router.get('/catches/:id/edit', requireAdmin, (req, res) => {
  const db = req.app.locals.db;
  const catchRow = getCatch(db, req.params.id);
  if (!catchRow) return res.status(404).send('Not found');
  res.render('admin/catch-form', { catchRow, action: `/admin/catches/${catchRow.id}` });
});

router.post('/catches/:id/delete', requireAdmin, (req, res) => {
  const db = req.app.locals.db;
  const existing = getCatch(db, req.params.id);
  if (existing) {
    const uploadDir = process.env.UPLOAD_DIR || path.join(__dirname, '..', 'uploads');
    const filePath = path.join(uploadDir, path.basename(existing.photo_path));
    try { fs.unlinkSync(filePath); } catch (e) { if (e.code !== 'ENOENT') throw e; }
    deleteCatch(db, req.params.id);
  }
  res.redirect('/admin');
});

router.post('/catches/:id', requireAdmin, upload.single('photo'), (req, res) => {
  const db = req.app.locals.db;
  const existing = getCatch(db, req.params.id);
  if (!existing) return res.status(404).send('Not found');
  const photo_path = req.file ? req.file.filename : existing.photo_path;
  if (req.file && existing.photo_path) {
    const uploadDir = process.env.UPLOAD_DIR || path.join(__dirname, '..', 'uploads');
    try { fs.unlinkSync(path.join(uploadDir, path.basename(existing.photo_path))); } catch (e) { if (e.code !== 'ENOENT') throw e; }
  }
  updateCatch(db, req.params.id, {
    photo_path,
    species: req.body.species,
    location_name: req.body.location_name,
    lat: req.body.lat ? parseFloat(req.body.lat) : null,
    lng: req.body.lng ? parseFloat(req.body.lng) : null,
    caught_at: req.body.caught_at,
    weight_oz: req.body.weight_oz ? parseInt(req.body.weight_oz) : null,
    length_in: req.body.length_in ? parseInt(req.body.length_in) : null,
    notes: req.body.notes || null
  });
  res.redirect('/admin');
});

// Events
router.get('/events/new', requireAdmin, (req, res) => {
  res.render('admin/event-form', { event: null, action: '/admin/events' });
});

router.post('/events', requireAdmin, (req, res) => {
  const db = req.app.locals.db;
  insertEvent(db, {
    title: req.body.title,
    description: req.body.description || null,
    location_name: req.body.location_name || null,
    lat: req.body.lat ? parseFloat(req.body.lat) : null,
    lng: req.body.lng ? parseFloat(req.body.lng) : null,
    event_at: req.body.event_at
  });
  res.redirect('/admin');
});

router.get('/events/:id/edit', requireAdmin, (req, res) => {
  const db = req.app.locals.db;
  const event = getEvent(db, req.params.id);
  if (!event) return res.status(404).send('Not found');
  res.render('admin/event-form', { event, action: `/admin/events/${event.id}` });
});

router.post('/events/:id/delete', requireAdmin, (req, res) => {
  const db = req.app.locals.db;
  deleteEvent(db, req.params.id);
  res.redirect('/admin');
});

router.post('/events/:id', requireAdmin, (req, res) => {
  const db = req.app.locals.db;
  const existing = getEvent(db, req.params.id);
  if (!existing) return res.status(404).send('Not found');
  updateEvent(db, req.params.id, {
    title: req.body.title,
    description: req.body.description || null,
    location_name: req.body.location_name || null,
    lat: req.body.lat ? parseFloat(req.body.lat) : null,
    lng: req.body.lng ? parseFloat(req.body.lng) : null,
    event_at: req.body.event_at
  });
  res.redirect('/admin');
});

// RSVPs view
router.get('/events/:id/rsvps', requireAdmin, (req, res) => {
  const db = req.app.locals.db;
  const event = getEvent(db, req.params.id);
  if (!event) return res.status(404).send('Not found');
  const rsvps = getRsvpsForEvent(db, req.params.id);
  res.render('admin/event-rsvps', { event, rsvps });
});

module.exports = router;
