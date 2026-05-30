# Fishing App Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a personal fishing blog and event scheduling web app deployable as a Docker container on Matt's home server.

**Architecture:** Server-rendered Node.js/Express app using EJS templates and SQLite. A public-facing blog shows fish catches and a shared calendar with RSVP. A password-protected `/admin` panel allows Matt to manage all content.

**Tech Stack:** Node.js, Express, EJS, better-sqlite3, Multer (file uploads), bcryptjs, express-session, method-override, Leaflet.js (OpenStreetMap, no API key), Jest + Supertest (tests), Docker

---

## File Map

| File | Responsibility |
|---|---|
| `app/server.js` | Express app setup, middleware wiring, start |
| `app/db.js` | SQLite connection, schema creation, seed helper |
| `app/middleware/auth.js` | Session guard for `/admin/*` routes |
| `app/routes/public.js` | GET routes: `/`, `/gallery`, `/catches/:id`, `/calendar`, `/about`, POST `/rsvp` |
| `app/routes/admin.js` | All `/admin/*` GET/POST routes |
| `app/views/layout.ejs` | Base HTML shell: nav, footer, CSS links |
| `app/views/index.ejs` | Home feed partial |
| `app/views/gallery.ejs` | Photo grid + filter controls |
| `app/views/catch.ejs` | Catch detail + Leaflet map |
| `app/views/calendar.ejs` | Event list + RSVP form |
| `app/views/about.ejs` | Static about page |
| `app/views/admin/login.ejs` | Admin login form |
| `app/views/admin/dashboard.ejs` | Admin home: catch + event lists |
| `app/views/admin/catch-form.ejs` | New/edit catch form with map pin picker |
| `app/views/admin/event-form.ejs` | New/edit event form with map pin picker |
| `app/views/admin/event-rsvps.ejs` | RSVP list for one event |
| `app/public/style.css` | Rustic theme (dark green, earthy brown, serif) |
| `app/public/admin.css` | Admin panel styles |
| `app/tests/db.test.js` | Unit tests for db.js helpers |
| `app/tests/routes.public.test.js` | Integration tests for public routes |
| `app/tests/routes.admin.test.js` | Integration tests for admin routes |
| `docker-compose.yml` | Docker stack definition |
| `.env.example` | Template for required env vars |

---

## Task 1: Project scaffold and package setup

**Files:**
- Create: `/home/matt/fishing-app/app/package.json`
- Create: `/home/matt/fishing-app/app/server.js`
- Create: `/home/matt/fishing-app/.env.example`

- [ ] **Step 1: Create the fishing-app directory structure**

```bash
mkdir -p /home/matt/fishing-app/app/middleware
mkdir -p /home/matt/fishing-app/app/routes
mkdir -p /home/matt/fishing-app/app/views/admin
mkdir -p /home/matt/fishing-app/app/public
mkdir -p /home/matt/fishing-app/app/uploads
mkdir -p /home/matt/fishing-app/app/tests
mkdir -p /home/matt/fishing-app/data
```

- [ ] **Step 2: Create `package.json`**

Write `/home/matt/fishing-app/app/package.json`:
```json
{
  "name": "matts-fishing-app",
  "version": "1.0.0",
  "main": "server.js",
  "scripts": {
    "start": "node server.js",
    "dev": "node --watch server.js",
    "test": "jest --runInBand"
  },
  "dependencies": {
    "bcryptjs": "^2.4.3",
    "better-sqlite3": "^9.4.3",
    "ejs": "^3.1.9",
    "express": "^4.18.3",
    "express-session": "^1.18.0",
    "method-override": "^3.0.0",
    "multer": "^1.4.5-lts.1"
  },
  "devDependencies": {
    "jest": "^29.7.0",
    "supertest": "^6.3.4"
  }
}
```

- [ ] **Step 3: Install dependencies**

```bash
cd /home/matt/fishing-app/app && npm install
```

Expected: `node_modules/` created, no errors.

- [ ] **Step 4: Create `.env.example`**

Write `/home/matt/fishing-app/.env.example`:
```
ADMIN_PASSWORD_HASH=<run: node -e "const b=require('bcryptjs');console.log(b.hashSync('yourpassword',10))">
SESSION_SECRET=change-me-to-a-random-string
PORT=3001
UPLOAD_DIR=/app/uploads
DB_PATH=/app/data/db.sqlite
```

- [ ] **Step 5: Create minimal `server.js`**

Write `/home/matt/fishing-app/app/server.js`:
```js
require('dotenv').config();
const express = require('express');
const session = require('express-session');
const methodOverride = require('method-override');
const path = require('path');

const app = express();

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(methodOverride('_method'));
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(process.env.UPLOAD_DIR || path.join(__dirname, 'uploads')));

app.use(session({
  secret: process.env.SESSION_SECRET || 'dev-secret',
  resave: false,
  saveUninitialized: false,
  cookie: { secure: false }
}));

const publicRoutes = require('./routes/public');
const adminRoutes = require('./routes/admin');

app.use('/', publicRoutes);
app.use('/admin', adminRoutes);

const PORT = process.env.PORT || 3001;

if (require.main === module) {
  app.listen(PORT, () => console.log(`Fishing app running on port ${PORT}`));
}

module.exports = app;
```

- [ ] **Step 6: Commit**

```bash
cd /home/matt/fishing-app && git init && git add . && git commit -m "feat: project scaffold and package setup"
```

---

## Task 2: Database layer

**Files:**
- Create: `/home/matt/fishing-app/app/db.js`
- Create: `/home/matt/fishing-app/app/tests/db.test.js`

- [ ] **Step 1: Write the failing tests**

Write `/home/matt/fishing-app/app/tests/db.test.js`:
```js
const { createDb, getCatches, getCatch, insertCatch, updateCatch, deleteCatch,
        getEvents, getEvent, insertEvent, updateEvent, deleteEvent,
        getUpcomingEvents, insertRsvp, getRsvpsForEvent } = require('../db');

let db;

beforeEach(() => {
  db = createDb(':memory:');
});

afterEach(() => {
  db.close();
});

describe('catches', () => {
  test('insertCatch and getCatches', () => {
    insertCatch(db, { species: 'Bass', location_name: 'Lake X', lat: 42.1, lng: -71.5,
      caught_at: '2026-05-01', weight_oz: 32, length_in: 14, notes: 'big one', photo_path: 'a.jpg' });
    const catches = getCatches(db);
    expect(catches).toHaveLength(1);
    expect(catches[0].species).toBe('Bass');
    expect(catches[0].photo_path).toBe('a.jpg');
  });

  test('getCatch returns single row', () => {
    insertCatch(db, { species: 'Trout', location_name: 'Pond', lat: null, lng: null,
      caught_at: '2026-05-02', weight_oz: null, length_in: null, notes: null, photo_path: 'b.jpg' });
    const all = getCatches(db);
    const row = getCatch(db, all[0].id);
    expect(row.species).toBe('Trout');
  });

  test('updateCatch modifies row', () => {
    insertCatch(db, { species: 'Bass', location_name: 'L', lat: null, lng: null,
      caught_at: '2026-01-01', weight_oz: null, length_in: null, notes: null, photo_path: 'c.jpg' });
    const id = getCatches(db)[0].id;
    updateCatch(db, id, { species: 'Pike', location_name: 'L', lat: null, lng: null,
      caught_at: '2026-01-01', weight_oz: null, length_in: null, notes: null, photo_path: 'c.jpg' });
    expect(getCatch(db, id).species).toBe('Pike');
  });

  test('deleteCatch removes row', () => {
    insertCatch(db, { species: 'Bass', location_name: 'L', lat: null, lng: null,
      caught_at: '2026-01-01', weight_oz: null, length_in: null, notes: null, photo_path: 'd.jpg' });
    const id = getCatches(db)[0].id;
    deleteCatch(db, id);
    expect(getCatches(db)).toHaveLength(0);
  });
});

describe('events', () => {
  test('insertEvent and getEvents', () => {
    insertEvent(db, { title: 'Morning Trip', description: 'Early', location_name: 'Lake X',
      lat: 42.1, lng: -71.5, event_at: '2026-06-01T06:00:00' });
    expect(getEvents(db)).toHaveLength(1);
    expect(getEvents(db)[0].title).toBe('Morning Trip');
  });

  test('getUpcomingEvents returns future events sorted by date', () => {
    insertEvent(db, { title: 'Past', description: null, location_name: null,
      lat: null, lng: null, event_at: '2020-01-01T00:00:00' });
    insertEvent(db, { title: 'Future', description: null, location_name: null,
      lat: null, lng: null, event_at: '2099-01-01T00:00:00' });
    const upcoming = getUpcomingEvents(db);
    expect(upcoming).toHaveLength(1);
    expect(upcoming[0].title).toBe('Future');
  });

  test('deleteEvent removes event and its rsvps', () => {
    insertEvent(db, { title: 'Trip', description: null, location_name: null,
      lat: null, lng: null, event_at: '2099-01-01T00:00:00' });
    const id = getEvents(db)[0].id;
    insertRsvp(db, id, 'Alice');
    deleteEvent(db, id);
    expect(getEvents(db)).toHaveLength(0);
    expect(getRsvpsForEvent(db, id)).toHaveLength(0);
  });
});

describe('rsvps', () => {
  test('insertRsvp and getRsvpsForEvent', () => {
    insertEvent(db, { title: 'Trip', description: null, location_name: null,
      lat: null, lng: null, event_at: '2099-06-01T06:00:00' });
    const eventId = getEvents(db)[0].id;
    insertRsvp(db, eventId, 'Bob');
    insertRsvp(db, eventId, 'Carol');
    const rsvps = getRsvpsForEvent(db, eventId);
    expect(rsvps).toHaveLength(2);
    expect(rsvps.map(r => r.name)).toContain('Bob');
  });
});
```

- [ ] **Step 2: Run tests — verify they fail**

```bash
cd /home/matt/fishing-app/app && npm test -- tests/db.test.js
```

Expected: FAIL — `Cannot find module '../db'`

- [ ] **Step 3: Implement `db.js`**

Write `/home/matt/fishing-app/app/db.js`:
```js
const Database = require('better-sqlite3');

function createDb(dbPath) {
  const db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  db.exec(`
    CREATE TABLE IF NOT EXISTS catches (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      photo_path TEXT NOT NULL,
      species TEXT NOT NULL,
      location_name TEXT NOT NULL,
      lat REAL,
      lng REAL,
      caught_at TEXT NOT NULL,
      weight_oz INTEGER,
      length_in INTEGER,
      notes TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      description TEXT,
      location_name TEXT,
      lat REAL,
      lng REAL,
      event_at TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS rsvps (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      event_id INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  return db;
}

function getCatches(db) {
  return db.prepare('SELECT * FROM catches ORDER BY caught_at DESC').all();
}

function getCatch(db, id) {
  return db.prepare('SELECT * FROM catches WHERE id = ?').get(id);
}

function insertCatch(db, data) {
  return db.prepare(`
    INSERT INTO catches (photo_path, species, location_name, lat, lng, caught_at, weight_oz, length_in, notes)
    VALUES (@photo_path, @species, @location_name, @lat, @lng, @caught_at, @weight_oz, @length_in, @notes)
  `).run(data);
}

function updateCatch(db, id, data) {
  return db.prepare(`
    UPDATE catches SET photo_path=@photo_path, species=@species, location_name=@location_name,
      lat=@lat, lng=@lng, caught_at=@caught_at, weight_oz=@weight_oz, length_in=@length_in, notes=@notes
    WHERE id=@id
  `).run({ ...data, id });
}

function deleteCatch(db, id) {
  return db.prepare('DELETE FROM catches WHERE id = ?').run(id);
}

function getEvents(db) {
  return db.prepare('SELECT * FROM events ORDER BY event_at ASC').all();
}

function getEvent(db, id) {
  return db.prepare('SELECT * FROM events WHERE id = ?').get(id);
}

function insertEvent(db, data) {
  return db.prepare(`
    INSERT INTO events (title, description, location_name, lat, lng, event_at)
    VALUES (@title, @description, @location_name, @lat, @lng, @event_at)
  `).run(data);
}

function updateEvent(db, id, data) {
  return db.prepare(`
    UPDATE events SET title=@title, description=@description, location_name=@location_name,
      lat=@lat, lng=@lng, event_at=@event_at
    WHERE id=@id
  `).run({ ...data, id });
}

function deleteEvent(db, id) {
  return db.prepare('DELETE FROM events WHERE id = ?').run(id);
}

function getUpcomingEvents(db) {
  return db.prepare(`SELECT * FROM events WHERE event_at > datetime('now') ORDER BY event_at ASC`).all();
}

function insertRsvp(db, eventId, name) {
  return db.prepare('INSERT INTO rsvps (event_id, name) VALUES (?, ?)').run(eventId, name);
}

function getRsvpsForEvent(db, eventId) {
  return db.prepare('SELECT * FROM rsvps WHERE event_id = ? ORDER BY created_at ASC').all(eventId);
}

module.exports = {
  createDb, getCatches, getCatch, insertCatch, updateCatch, deleteCatch,
  getEvents, getEvent, insertEvent, updateEvent, deleteEvent,
  getUpcomingEvents, insertRsvp, getRsvpsForEvent
};
```

- [ ] **Step 4: Run tests — verify they pass**

```bash
cd /home/matt/fishing-app/app && npm test -- tests/db.test.js
```

Expected: All tests PASS.

- [ ] **Step 5: Commit**

```bash
cd /home/matt/fishing-app && git add app/db.js app/tests/db.test.js && git commit -m "feat: database layer with schema and helpers"
```

---

## Task 3: Auth middleware and shared app db instance

**Files:**
- Create: `/home/matt/fishing-app/app/middleware/auth.js`
- Modify: `/home/matt/fishing-app/app/server.js`

- [ ] **Step 1: Create `middleware/auth.js`**

Write `/home/matt/fishing-app/app/middleware/auth.js`:
```js
function requireAdmin(req, res, next) {
  if (req.session && req.session.isAdmin) {
    return next();
  }
  res.redirect('/admin/login');
}

module.exports = { requireAdmin };
```

- [ ] **Step 2: Add DB initialization to `server.js`**

The app needs a single shared DB instance. Update `server.js` — replace the `publicRoutes`/`adminRoutes` require block with:

```js
const { createDb } = require('./db');
const dbPath = process.env.DB_PATH || require('path').join(__dirname, 'data', 'db.sqlite');
// In test mode use in-memory db passed via app.locals
if (process.env.NODE_ENV !== 'test') {
  const db = createDb(dbPath);
  app.locals.db = db;
}

const publicRoutes = require('./routes/public');
const adminRoutes = require('./routes/admin');

app.use('/', publicRoutes);
app.use('/admin', adminRoutes);
```

- [ ] **Step 3: Create stub route files so the app starts**

Write `/home/matt/fishing-app/app/routes/public.js`:
```js
const express = require('express');
const router = express.Router();

router.get('/', (req, res) => res.send('ok'));

module.exports = router;
```

Write `/home/matt/fishing-app/app/routes/admin.js`:
```js
const express = require('express');
const router = express.Router();

router.get('/login', (req, res) => res.send('login'));

module.exports = router;
```

- [ ] **Step 4: Verify app starts without errors**

```bash
cd /home/matt/fishing-app/app && NODE_ENV=test node -e "const app = require('./server'); console.log('OK')"
```

Expected: prints `OK` with no errors.

- [ ] **Step 5: Commit**

```bash
cd /home/matt/fishing-app && git add app/middleware/auth.js app/routes/public.js app/routes/admin.js app/server.js && git commit -m "feat: auth middleware and app db wiring"
```

---

## Task 4: Public routes

**Files:**
- Modify: `/home/matt/fishing-app/app/routes/public.js`
- Create: `/home/matt/fishing-app/app/tests/routes.public.test.js`

- [ ] **Step 1: Write failing route tests**

Write `/home/matt/fishing-app/app/tests/routes.public.test.js`:
```js
const request = require('supertest');
const app = require('../server');
const { createDb, insertCatch, insertEvent, insertRsvp } = require('../db');

let db;

beforeEach(() => {
  db = createDb(':memory:');
  app.locals.db = db;
});

afterEach(() => db.close());

test('GET / returns 200', async () => {
  const res = await request(app).get('/');
  expect(res.status).toBe(200);
});

test('GET /gallery returns 200', async () => {
  const res = await request(app).get('/gallery');
  expect(res.status).toBe(200);
});

test('GET /catches/:id returns 200 for existing catch', async () => {
  insertCatch(db, { species: 'Bass', location_name: 'Lake X', lat: 42.1, lng: -71.5,
    caught_at: '2026-05-01', weight_oz: null, length_in: null, notes: null, photo_path: 'x.jpg' });
  const catches = db.prepare('SELECT id FROM catches').all();
  const res = await request(app).get(`/catches/${catches[0].id}`);
  expect(res.status).toBe(200);
});

test('GET /catches/:id returns 404 for missing catch', async () => {
  const res = await request(app).get('/catches/9999');
  expect(res.status).toBe(404);
});

test('GET /calendar returns 200', async () => {
  const res = await request(app).get('/calendar');
  expect(res.status).toBe(200);
});

test('POST /rsvp adds rsvp and redirects', async () => {
  insertEvent(db, { title: 'Trip', description: null, location_name: null,
    lat: null, lng: null, event_at: '2099-06-01T06:00:00' });
  const eventId = db.prepare('SELECT id FROM events').get().id;
  const res = await request(app).post('/rsvp')
    .send(`event_id=${eventId}&name=Alice`)
    .set('Content-Type', 'application/x-www-form-urlencoded');
  expect(res.status).toBe(302);
  expect(res.headers.location).toBe('/calendar');
  const rsvps = db.prepare('SELECT * FROM rsvps WHERE event_id=?').all(eventId);
  expect(rsvps).toHaveLength(1);
  expect(rsvps[0].name).toBe('Alice');
});

test('GET /about returns 200', async () => {
  const res = await request(app).get('/about');
  expect(res.status).toBe(200);
});
```

- [ ] **Step 2: Run tests — verify they fail**

```bash
cd /home/matt/fishing-app/app && npm test -- tests/routes.public.test.js
```

Expected: FAIL — routes return stub responses / views not found.

- [ ] **Step 3: Implement public routes**

Write `/home/matt/fishing-app/app/routes/public.js`:
```js
const express = require('express');
const router = express.Router();
const { getCatches, getCatch, getUpcomingEvents, getEvents, insertRsvp, getRsvpsForEvent } = require('../db');

router.get('/', (req, res) => {
  const db = req.app.locals.db;
  const catches = getCatches(db).slice(0, 10);
  const upcoming = getUpcomingEvents(db).slice(0, 3);
  res.render('index', { catches, upcoming });
});

router.get('/gallery', (req, res) => {
  const db = req.app.locals.db;
  const { species, location } = req.query;
  let catches = getCatches(db);
  if (species) catches = catches.filter(c => c.species.toLowerCase().includes(species.toLowerCase()));
  if (location) catches = catches.filter(c => c.location_name.toLowerCase().includes(location.toLowerCase()));
  const allSpecies = [...new Set(getCatches(db).map(c => c.species))].sort();
  const allLocations = [...new Set(getCatches(db).map(c => c.location_name))].sort();
  res.render('gallery', { catches, allSpecies, allLocations, filter: { species, location } });
});

router.get('/catches/:id', (req, res) => {
  const db = req.app.locals.db;
  const catchRow = getCatch(db, req.params.id);
  if (!catchRow) return res.status(404).send('Not found');
  res.render('catch', { catchRow });
});

router.get('/calendar', (req, res) => {
  const db = req.app.locals.db;
  const events = getUpcomingEvents(db).map(e => ({
    ...e,
    rsvps: getRsvpsForEvent(db, e.id)
  }));
  res.render('calendar', { events });
});

router.post('/rsvp', (req, res) => {
  const db = req.app.locals.db;
  const { event_id, name } = req.body;
  if (event_id && name && name.trim()) {
    insertRsvp(db, event_id, name.trim());
  }
  res.redirect('/calendar');
});

router.get('/about', (req, res) => {
  res.render('about');
});

module.exports = router;
```

- [ ] **Step 4: Create all required EJS views**

Write `/home/matt/fishing-app/app/views/layout.ejs`:
```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title><%= typeof title !== 'undefined' ? title + ' | ' : '' %>Matt's Catches</title>
  <link rel="stylesheet" href="/style.css">
  <%- typeof extraHead !== 'undefined' ? extraHead : '' %>
</head>
<body>
  <nav class="site-nav">
    <a class="site-title" href="/">🎣 Matt's Catches</a>
    <ul>
      <li><a href="/">Home</a></li>
      <li><a href="/gallery">Gallery</a></li>
      <li><a href="/calendar">Calendar</a></li>
      <li><a href="/about">About</a></li>
    </ul>
  </nav>
  <main>
    <%- body %>
  </main>
  <footer>
    <p>Matt's Fishing App</p>
  </footer>
</body>
</html>
```

Write `/home/matt/fishing-app/app/views/index.ejs`:
```html
<% layout('layout') %>
<h1>Recent Catches</h1>
<% if (upcoming.length > 0) { %>
  <section class="upcoming-teaser">
    <h2>Upcoming Trips</h2>
    <ul>
      <% upcoming.forEach(e => { %>
        <li><a href="/calendar"><%= e.title %></a> — <%= new Date(e.event_at).toLocaleDateString() %></li>
      <% }) %>
    </ul>
  </section>
<% } %>
<section class="catch-feed">
  <% if (catches.length === 0) { %>
    <p>No catches yet. Check back soon!</p>
  <% } %>
  <% catches.forEach(c => { %>
    <article class="catch-card">
      <a href="/catches/<%= c.id %>">
        <img src="/uploads/<%= c.photo_path %>" alt="<%= c.species %>" loading="lazy">
        <div class="catch-card-info">
          <h3><%= c.species %></h3>
          <p class="location"><%= c.location_name %></p>
          <p class="date"><%= new Date(c.caught_at).toLocaleDateString() %></p>
        </div>
      </a>
    </article>
  <% }) %>
</section>
```

Write `/home/matt/fishing-app/app/views/gallery.ejs`:
```html
<% layout('layout') %>
<h1>Gallery</h1>
<form class="filter-form" method="get" action="/gallery">
  <label>Species:
    <select name="species">
      <option value="">All</option>
      <% allSpecies.forEach(s => { %>
        <option value="<%= s %>" <%= filter.species === s ? 'selected' : '' %>><%= s %></option>
      <% }) %>
    </select>
  </label>
  <label>Location:
    <select name="location">
      <option value="">All</option>
      <% allLocations.forEach(l => { %>
        <option value="<%= l %>" <%= filter.location === l ? 'selected' : '' %>><%= l %></option>
      <% }) %>
    </select>
  </label>
  <button type="submit">Filter</button>
  <a href="/gallery">Clear</a>
</form>
<section class="gallery-grid">
  <% catches.forEach(c => { %>
    <a href="/catches/<%= c.id %>" class="gallery-item">
      <img src="/uploads/<%= c.photo_path %>" alt="<%= c.species %>" loading="lazy">
      <span><%= c.species %></span>
    </a>
  <% }) %>
  <% if (catches.length === 0) { %><p>No catches match that filter.</p><% } %>
</section>
```

Write `/home/matt/fishing-app/app/views/catch.ejs`:
```html
<% layout('layout') %>
<% extraHead = '<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"><script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>' %>
<article class="catch-detail">
  <img src="/uploads/<%= catchRow.photo_path %>" alt="<%= catchRow.species %>">
  <h1><%= catchRow.species %></h1>
  <p class="location">📍 <%= catchRow.location_name %></p>
  <p class="date">🗓 <%= new Date(catchRow.caught_at).toLocaleDateString() %></p>
  <% if (catchRow.weight_oz) { %><p>⚖️ <%= (catchRow.weight_oz / 16).toFixed(1) %> lbs (<%= catchRow.weight_oz %> oz)</p><% } %>
  <% if (catchRow.length_in) { %><p>📏 <%= catchRow.length_in %>"</p><% } %>
  <% if (catchRow.notes) { %><p class="notes"><%= catchRow.notes %></p><% } %>
  <% if (catchRow.lat && catchRow.lng) { %>
    <div id="map" style="height:300px;margin-top:1rem;border-radius:6px;"></div>
    <script>
      const map = L.map('map').setView([<%= catchRow.lat %>, <%= catchRow.lng %>], 13);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors'
      }).addTo(map);
      L.marker([<%= catchRow.lat %>, <%= catchRow.lng %>]).addTo(map)
        .bindPopup('<%= catchRow.species %> — <%= catchRow.location_name %>').openPopup();
    </script>
  <% } %>
</article>
<a href="/gallery">← Back to Gallery</a>
```

Write `/home/matt/fishing-app/app/views/calendar.ejs`:
```html
<% layout('layout') %>
<h1>Fishing Calendar</h1>
<% if (events.length === 0) { %>
  <p>No upcoming trips scheduled. Check back soon!</p>
<% } %>
<% events.forEach(e => { %>
  <article class="event-card">
    <h2><%= e.title %></h2>
    <p class="date">🗓 <%= new Date(e.event_at).toLocaleString() %></p>
    <% if (e.location_name) { %><p class="location">📍 <%= e.location_name %></p><% } %>
    <% if (e.description) { %><p><%= e.description %></p><% } %>
    <details>
      <summary><%= e.rsvps.length %> going<% if (e.rsvps.length > 0) { %>: <%= e.rsvps.map(r=>r.name).join(', ') %><% } %></summary>
      <form class="rsvp-form" method="post" action="/rsvp">
        <input type="hidden" name="event_id" value="<%= e.id %>">
        <input type="text" name="name" placeholder="Your name" required maxlength="80">
        <button type="submit">I'm in!</button>
      </form>
    </details>
  </article>
<% }) %>
```

Write `/home/matt/fishing-app/app/views/about.ejs`:
```html
<% layout('layout') %>
<h1>About</h1>
<p>Welcome to Matt's fishing log. This is where the catches get documented and the trips get planned.</p>
<p>Want to join a trip? Check the <a href="/calendar">Calendar</a> and RSVP!</p>
```

- [ ] **Step 5: Install `express-ejs-layouts` (needed for `layout()` in views)**

```bash
cd /home/matt/fishing-app/app && npm install express-ejs-layouts
```

Add to `server.js` after `app.set('views', ...)`:
```js
const ejsLayouts = require('express-ejs-layouts');
app.use(ejsLayouts);
app.set('layout', 'layout');
```

- [ ] **Step 6: Run tests — verify they pass**

```bash
cd /home/matt/fishing-app/app && npm test -- tests/routes.public.test.js
```

Expected: All tests PASS.

- [ ] **Step 7: Commit**

```bash
cd /home/matt/fishing-app && git add -A && git commit -m "feat: public routes and EJS views"
```

---

## Task 5: Admin routes

**Files:**
- Modify: `/home/matt/fishing-app/app/routes/admin.js`
- Create: `/home/matt/fishing-app/app/tests/routes.admin.test.js`
- Create: admin EJS views

- [ ] **Step 1: Write failing admin route tests**

Write `/home/matt/fishing-app/app/tests/routes.admin.test.js`:
```js
const request = require('supertest');
const bcrypt = require('bcryptjs');
const app = require('../server');
const { createDb, insertCatch, insertEvent } = require('../db');

let db;
const HASH = bcrypt.hashSync('testpass', 10);

beforeEach(() => {
  db = createDb(':memory:');
  app.locals.db = db;
  process.env.ADMIN_PASSWORD_HASH = HASH;
});

afterEach(() => db.close());

async function loginAgent() {
  const agent = request.agent(app);
  await agent.post('/admin/login')
    .send('password=testpass')
    .set('Content-Type', 'application/x-www-form-urlencoded');
  return agent;
}

test('GET /admin/login returns 200', async () => {
  const res = await request(app).get('/admin/login');
  expect(res.status).toBe(200);
});

test('POST /admin/login with wrong password returns 401', async () => {
  const res = await request(app).post('/admin/login')
    .send('password=wrong')
    .set('Content-Type', 'application/x-www-form-urlencoded');
  expect(res.status).toBe(401);
});

test('POST /admin/login with correct password redirects to /admin', async () => {
  const res = await request(app).post('/admin/login')
    .send('password=testpass')
    .set('Content-Type', 'application/x-www-form-urlencoded');
  expect(res.status).toBe(302);
  expect(res.headers.location).toBe('/admin');
});

test('GET /admin without session redirects to login', async () => {
  const res = await request(app).get('/admin');
  expect(res.status).toBe(302);
  expect(res.headers.location).toBe('/admin/login');
});

test('GET /admin with session returns 200', async () => {
  const agent = await loginAgent();
  const res = await agent.get('/admin');
  expect(res.status).toBe(200);
});

test('POST /admin/catches creates catch and redirects', async () => {
  const agent = await loginAgent();
  const res = await agent.post('/admin/catches')
    .field('species', 'Bass')
    .field('location_name', 'Lake X')
    .field('caught_at', '2026-05-01')
    .field('lat', '42.1')
    .field('lng', '-71.5')
    .field('weight_oz', '32')
    .field('length_in', '14')
    .field('notes', 'nice one')
    .attach('photo', Buffer.from('fake'), { filename: 'test.jpg', contentType: 'image/jpeg' });
  expect(res.status).toBe(302);
  expect(res.headers.location).toBe('/admin');
  expect(db.prepare('SELECT * FROM catches').all()).toHaveLength(1);
});

test('POST /admin/catches/:id/delete removes catch', async () => {
  insertCatch(db, { species: 'Bass', location_name: 'L', lat: null, lng: null,
    caught_at: '2026-01-01', weight_oz: null, length_in: null, notes: null, photo_path: 'test.jpg' });
  const id = db.prepare('SELECT id FROM catches').get().id;
  const agent = await loginAgent();
  const res = await agent.post(`/admin/catches/${id}/delete`);
  expect(res.status).toBe(302);
  expect(db.prepare('SELECT * FROM catches').all()).toHaveLength(0);
});

test('POST /admin/events creates event and redirects', async () => {
  const agent = await loginAgent();
  const res = await agent.post('/admin/events')
    .send('title=Morning+Trip&description=Early&location_name=Lake+X&lat=42.1&lng=-71.5&event_at=2099-06-01T06%3A00')
    .set('Content-Type', 'application/x-www-form-urlencoded');
  expect(res.status).toBe(302);
  expect(db.prepare('SELECT * FROM events').all()).toHaveLength(1);
});

test('POST /admin/events/:id/delete removes event', async () => {
  insertEvent(db, { title: 'Trip', description: null, location_name: null,
    lat: null, lng: null, event_at: '2099-06-01T06:00:00' });
  const id = db.prepare('SELECT id FROM events').get().id;
  const agent = await loginAgent();
  const res = await agent.post(`/admin/events/${id}/delete`);
  expect(res.status).toBe(302);
  expect(db.prepare('SELECT * FROM events').all()).toHaveLength(0);
});
```

- [ ] **Step 2: Run tests — verify they fail**

```bash
cd /home/matt/fishing-app/app && npm test -- tests/routes.admin.test.js
```

Expected: FAIL — admin routes return stubs.

- [ ] **Step 3: Implement admin routes**

Write `/home/matt/fishing-app/app/routes/admin.js`:
```js
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
const upload = multer({ storage, limits: { fileSize: 20 * 1024 * 1024 } });

// Auth
router.get('/login', (req, res) => res.render('admin/login', { error: null }));

router.post('/login', async (req, res) => {
  const hash = process.env.ADMIN_PASSWORD_HASH || '';
  const match = await bcrypt.compare(req.body.password || '', hash);
  if (!match) return res.status(401).render('admin/login', { error: 'Invalid password' });
  req.session.isAdmin = true;
  res.redirect('/admin');
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

router.post('/catches/:id', requireAdmin, upload.single('photo'), (req, res) => {
  const db = req.app.locals.db;
  const existing = getCatch(db, req.params.id);
  if (!existing) return res.status(404).send('Not found');
  const photo_path = req.file ? req.file.filename : existing.photo_path;
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

router.post('/catches/:id/delete', requireAdmin, (req, res) => {
  const db = req.app.locals.db;
  const existing = getCatch(db, req.params.id);
  if (existing) {
    const uploadDir = process.env.UPLOAD_DIR || path.join(__dirname, '..', 'uploads');
    const filePath = path.join(uploadDir, existing.photo_path);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    deleteCatch(db, req.params.id);
  }
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

router.post('/events/:id', requireAdmin, (req, res) => {
  const db = req.app.locals.db;
  if (!getEvent(db, req.params.id)) return res.status(404).send('Not found');
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

router.post('/events/:id/delete', requireAdmin, (req, res) => {
  const db = req.app.locals.db;
  deleteEvent(db, req.params.id);
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
```

- [ ] **Step 4: Create admin EJS views**

Write `/home/matt/fishing-app/app/views/admin/login.ejs`:
```html
<% layout('../layout') %>
<div class="admin-login">
  <h1>Admin Login</h1>
  <% if (error) { %><p class="error"><%= error %></p><% } %>
  <form method="post" action="/admin/login">
    <label>Password <input type="password" name="password" autofocus required></label>
    <button type="submit">Login</button>
  </form>
</div>
```

Write `/home/matt/fishing-app/app/views/admin/dashboard.ejs`:
```html
<% layout('../layout') %>
<div class="admin-dashboard">
  <h1>Admin Dashboard</h1>
  <section>
    <h2>Catches <a href="/admin/catches/new" class="btn-sm">+ New</a></h2>
    <table>
      <thead><tr><th>Photo</th><th>Species</th><th>Location</th><th>Date</th><th>Actions</th></tr></thead>
      <tbody>
        <% catches.forEach(c => { %>
          <tr>
            <td><img src="/uploads/<%= c.photo_path %>" style="height:40px;border-radius:3px;"></td>
            <td><%= c.species %></td>
            <td><%= c.location_name %></td>
            <td><%= new Date(c.caught_at).toLocaleDateString() %></td>
            <td>
              <a href="/admin/catches/<%= c.id %>/edit">Edit</a>
              <form method="post" action="/admin/catches/<%= c.id %>/delete" style="display:inline"
                    onsubmit="return confirm('Delete this catch?')">
                <button type="submit">Delete</button>
              </form>
            </td>
          </tr>
        <% }) %>
        <% if (catches.length === 0) { %><tr><td colspan="5">No catches yet.</td></tr><% } %>
      </tbody>
    </table>
  </section>
  <section>
    <h2>Events <a href="/admin/events/new" class="btn-sm">+ New</a></h2>
    <table>
      <thead><tr><th>Title</th><th>Date</th><th>Location</th><th>Actions</th></tr></thead>
      <tbody>
        <% events.forEach(e => { %>
          <tr>
            <td><%= e.title %></td>
            <td><%= new Date(e.event_at).toLocaleString() %></td>
            <td><%= e.location_name || '—' %></td>
            <td>
              <a href="/admin/events/<%= e.id %>/rsvps">RSVPs</a>
              <a href="/admin/events/<%= e.id %>/edit">Edit</a>
              <form method="post" action="/admin/events/<%= e.id %>/delete" style="display:inline"
                    onsubmit="return confirm('Delete this event?')">
                <button type="submit">Delete</button>
              </form>
            </td>
          </tr>
        <% }) %>
        <% if (events.length === 0) { %><tr><td colspan="4">No events yet.</td></tr><% } %>
      </tbody>
    </table>
  </section>
  <p><a href="/admin/logout">Logout</a></p>
</div>
```

Write `/home/matt/fishing-app/app/views/admin/catch-form.ejs`:
```html
<% layout('../layout') %>
<% extraHead = '<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"><script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>' %>
<h1><%= catchRow ? 'Edit Catch' : 'New Catch' %></h1>
<form method="post" action="<%= action %>" enctype="multipart/form-data" class="admin-form">
  <label>Photo <input type="file" name="photo" <%= catchRow ? '' : 'required' %> accept="image/*"></label>
  <% if (catchRow) { %><p>Current: <img src="/uploads/<%= catchRow.photo_path %>" style="height:60px;"></p><% } %>
  <label>Species <input type="text" name="species" value="<%= catchRow ? catchRow.species : '' %>" required></label>
  <label>Location Name <input type="text" name="location_name" value="<%= catchRow ? catchRow.location_name : '' %>" required></label>
  <label>Date Caught <input type="date" name="caught_at" value="<%= catchRow ? catchRow.caught_at.slice(0,10) : '' %>" required></label>
  <label>Weight (oz) <input type="number" name="weight_oz" value="<%= catchRow ? catchRow.weight_oz || '' : '' %>"></label>
  <label>Length (in) <input type="number" name="length_in" value="<%= catchRow ? catchRow.length_in || '' : '' %>"></label>
  <label>Notes <textarea name="notes"><%= catchRow ? catchRow.notes || '' : '' %></textarea></label>
  <p>Click the map to set the catch location:</p>
  <div id="map" style="height:300px;margin-bottom:1rem;border-radius:6px;"></div>
  <input type="hidden" name="lat" id="lat" value="<%= catchRow ? catchRow.lat || '' : '' %>">
  <input type="hidden" name="lng" id="lng" value="<%= catchRow ? catchRow.lng || '' : '' %>">
  <button type="submit"><%= catchRow ? 'Update Catch' : 'Add Catch' %></button>
  <a href="/admin">Cancel</a>
</form>
<script>
  const initLat = parseFloat(document.getElementById('lat').value) || 42.36;
  const initLng = parseFloat(document.getElementById('lng').value) || -71.06;
  const map = L.map('map').setView([initLat, initLng], 8);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap contributors'
  }).addTo(map);
  let marker;
  <% if (catchRow && catchRow.lat && catchRow.lng) { %>
    marker = L.marker([<%= catchRow.lat %>, <%= catchRow.lng %>]).addTo(map);
  <% } %>
  map.on('click', e => {
    if (marker) map.removeLayer(marker);
    marker = L.marker(e.latlng).addTo(map);
    document.getElementById('lat').value = e.latlng.lat.toFixed(6);
    document.getElementById('lng').value = e.latlng.lng.toFixed(6);
  });
</script>
```

Write `/home/matt/fishing-app/app/views/admin/event-form.ejs`:
```html
<% layout('../layout') %>
<% extraHead = '<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"><script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>' %>
<h1><%= event ? 'Edit Event' : 'New Event' %></h1>
<form method="post" action="<%= action %>" class="admin-form">
  <label>Title <input type="text" name="title" value="<%= event ? event.title : '' %>" required></label>
  <label>Date & Time <input type="datetime-local" name="event_at" value="<%= event ? event.event_at.slice(0,16) : '' %>" required></label>
  <label>Location Name <input type="text" name="location_name" value="<%= event ? event.location_name || '' : '' %>"></label>
  <label>Description <textarea name="description"><%= event ? event.description || '' : '' %></textarea></label>
  <p>Click the map to set the event location (optional):</p>
  <div id="map" style="height:300px;margin-bottom:1rem;border-radius:6px;"></div>
  <input type="hidden" name="lat" id="lat" value="<%= event ? event.lat || '' : '' %>">
  <input type="hidden" name="lng" id="lng" value="<%= event ? event.lng || '' : '' %>">
  <button type="submit"><%= event ? 'Update Event' : 'Create Event' %></button>
  <a href="/admin">Cancel</a>
</form>
<script>
  const initLat = parseFloat(document.getElementById('lat').value) || 42.36;
  const initLng = parseFloat(document.getElementById('lng').value) || -71.06;
  const map = L.map('map').setView([initLat, initLng], 8);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap contributors'
  }).addTo(map);
  let marker;
  <% if (event && event.lat && event.lng) { %>
    marker = L.marker([<%= event.lat %>, <%= event.lng %>]).addTo(map);
  <% } %>
  map.on('click', e => {
    if (marker) map.removeLayer(marker);
    marker = L.marker(e.latlng).addTo(map);
    document.getElementById('lat').value = e.latlng.lat.toFixed(6);
    document.getElementById('lng').value = e.latlng.lng.toFixed(6);
  });
</script>
```

Write `/home/matt/fishing-app/app/views/admin/event-rsvps.ejs`:
```html
<% layout('../layout') %>
<h1>RSVPs for: <%= event.title %></h1>
<p>📅 <%= new Date(event.event_at).toLocaleString() %></p>
<p><strong><%= rsvps.length %></strong> people going</p>
<% if (rsvps.length > 0) { %>
  <ul>
    <% rsvps.forEach(r => { %>
      <li><%= r.name %> <span class="date">(signed up <%= new Date(r.created_at).toLocaleDateString() %>)</span></li>
    <% }) %>
  </ul>
<% } else { %>
  <p>No RSVPs yet.</p>
<% } %>
<a href="/admin">← Back to Dashboard</a>
```

- [ ] **Step 5: Run tests — verify they pass**

```bash
cd /home/matt/fishing-app/app && npm test -- tests/routes.admin.test.js
```

Expected: All tests PASS.

- [ ] **Step 6: Commit**

```bash
cd /home/matt/fishing-app && git add -A && git commit -m "feat: admin routes and views"
```

---

## Task 6: CSS — Rustic theme

**Files:**
- Create: `/home/matt/fishing-app/app/public/style.css`
- Create: `/home/matt/fishing-app/app/public/admin.css`

- [ ] **Step 1: Write `style.css` (rustic theme)**

Write `/home/matt/fishing-app/app/public/style.css`:
```css
/* Rustic fishing theme */
:root {
  --green-dark: #1e3a1e;
  --green-mid: #2d5a27;
  --green-light: #4a7c40;
  --brown: #6b4226;
  --amber: #c8872a;
  --cream: #f5f0e8;
  --text: #2a1a0a;
  --text-light: #5a4030;
  --border: #c8a96e;
}

*, *::before, *::after { box-sizing: border-box; }

body {
  margin: 0;
  font-family: Georgia, 'Times New Roman', serif;
  background: var(--cream);
  color: var(--text);
  line-height: 1.6;
}

/* Nav */
.site-nav {
  background: var(--green-dark);
  padding: 0.8rem 1.5rem;
  display: flex;
  align-items: center;
  gap: 2rem;
  border-bottom: 3px solid var(--amber);
}
.site-title {
  color: var(--amber);
  font-size: 1.4rem;
  font-weight: bold;
  text-decoration: none;
  white-space: nowrap;
}
.site-nav ul {
  list-style: none;
  margin: 0; padding: 0;
  display: flex; gap: 1.5rem;
}
.site-nav ul a {
  color: #d4c9a8;
  text-decoration: none;
  font-size: 0.95rem;
}
.site-nav ul a:hover { color: var(--amber); }

/* Main */
main {
  max-width: 1100px;
  margin: 2rem auto;
  padding: 0 1.5rem;
}

h1, h2, h3 { color: var(--green-dark); }
a { color: var(--brown); }
a:hover { color: var(--amber); }

/* Catch feed */
.catch-feed {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: 1.5rem;
  margin-top: 1.5rem;
}
.catch-card {
  background: white;
  border: 1px solid var(--border);
  border-radius: 6px;
  overflow: hidden;
  box-shadow: 2px 2px 8px rgba(0,0,0,0.08);
  transition: transform 0.15s;
}
.catch-card:hover { transform: translateY(-2px); }
.catch-card a { text-decoration: none; color: inherit; display: block; }
.catch-card img { width: 100%; height: 180px; object-fit: cover; }
.catch-card-info { padding: 0.75rem 1rem; }
.catch-card-info h3 { margin: 0 0 0.25rem; font-size: 1.1rem; }
.catch-card-info .location, .catch-card-info .date { margin: 0; font-size: 0.85rem; color: var(--text-light); }

/* Upcoming events teaser */
.upcoming-teaser {
  background: var(--green-dark);
  color: #d4c9a8;
  padding: 1rem 1.5rem;
  border-radius: 6px;
  border-left: 4px solid var(--amber);
  margin-bottom: 2rem;
}
.upcoming-teaser h2 { color: var(--amber); margin-top: 0; }
.upcoming-teaser ul { margin: 0; padding-left: 1.2rem; }
.upcoming-teaser a { color: #c8d8b0; }

/* Gallery */
.gallery-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 1rem;
  margin-top: 1.5rem;
}
.gallery-item {
  display: block;
  text-decoration: none;
  position: relative;
  overflow: hidden;
  border-radius: 6px;
  border: 1px solid var(--border);
  aspect-ratio: 1;
}
.gallery-item img { width: 100%; height: 100%; object-fit: cover; transition: transform 0.2s; }
.gallery-item:hover img { transform: scale(1.05); }
.gallery-item span {
  position: absolute; bottom: 0; left: 0; right: 0;
  background: rgba(0,0,0,0.55);
  color: white; padding: 0.3rem 0.5rem; font-size: 0.8rem;
}

.filter-form { display: flex; gap: 1rem; align-items: flex-end; flex-wrap: wrap; margin-bottom: 1rem; }
.filter-form label { display: flex; flex-direction: column; gap: 0.2rem; font-size: 0.9rem; }
.filter-form select, .filter-form input { padding: 0.4rem; border: 1px solid var(--border); border-radius: 4px; }

/* Catch detail */
.catch-detail img { max-width: 100%; border-radius: 6px; border: 2px solid var(--border); }
.catch-detail h1 { margin-top: 1rem; }
.catch-detail .notes { background: white; padding: 0.75rem 1rem; border-left: 3px solid var(--amber); border-radius: 3px; }

/* Event cards */
.event-card {
  background: white;
  border: 1px solid var(--border);
  border-radius: 6px;
  padding: 1.25rem 1.5rem;
  margin-bottom: 1.25rem;
  box-shadow: 1px 1px 5px rgba(0,0,0,0.06);
}
.event-card h2 { margin-top: 0; color: var(--green-dark); }
.event-card .date, .event-card .location { color: var(--text-light); font-size: 0.9rem; margin: 0.25rem 0; }
.rsvp-form { display: flex; gap: 0.5rem; margin-top: 0.75rem; }
.rsvp-form input { padding: 0.4rem 0.6rem; border: 1px solid var(--border); border-radius: 4px; flex: 1; }
.rsvp-form button {
  background: var(--green-mid); color: white;
  border: none; padding: 0.4rem 1rem; border-radius: 4px; cursor: pointer;
}
.rsvp-form button:hover { background: var(--green-light); }

/* Footer */
footer {
  text-align: center;
  padding: 2rem;
  margin-top: 3rem;
  border-top: 2px solid var(--border);
  color: var(--text-light);
  font-size: 0.85rem;
}

/* Buttons */
button, .btn-sm {
  background: var(--green-mid);
  color: white;
  border: none;
  padding: 0.4rem 0.9rem;
  border-radius: 4px;
  cursor: pointer;
  font-family: inherit;
  font-size: 0.9rem;
  text-decoration: none;
}
button:hover, .btn-sm:hover { background: var(--green-light); }

/* Misc */
.error { color: #c0392b; }
details summary { cursor: pointer; color: var(--brown); }
```

Write `/home/matt/fishing-app/app/public/admin.css`:
```css
.admin-dashboard table { width: 100%; border-collapse: collapse; margin-top: 0.5rem; }
.admin-dashboard th, .admin-dashboard td { padding: 0.5rem 0.75rem; border: 1px solid #ddd; text-align: left; }
.admin-dashboard th { background: #f0ebe0; }
.admin-dashboard tr:hover td { background: #faf6ef; }
.admin-form { display: flex; flex-direction: column; gap: 0.75rem; max-width: 600px; }
.admin-form label { display: flex; flex-direction: column; gap: 0.25rem; font-size: 0.95rem; }
.admin-form input[type=text],
.admin-form input[type=date],
.admin-form input[type=datetime-local],
.admin-form input[type=number],
.admin-form textarea,
.admin-form select { padding: 0.4rem 0.6rem; border: 1px solid #c8a96e; border-radius: 4px; font-family: inherit; font-size: 0.95rem; }
.admin-form textarea { min-height: 80px; }
.admin-login { max-width: 320px; margin: 4rem auto; }
```

Add the admin CSS link to `layout.ejs` — update the `<head>` to include it for admin pages. The simplest approach: include it unconditionally since it's small:

In `views/layout.ejs`, add after the main stylesheet link:
```html
  <link rel="stylesheet" href="/admin.css">
```

- [ ] **Step 2: Run all tests to confirm nothing broke**

```bash
cd /home/matt/fishing-app/app && npm test
```

Expected: All tests PASS.

- [ ] **Step 3: Commit**

```bash
cd /home/matt/fishing-app && git add -A && git commit -m "feat: rustic CSS theme"
```

---

## Task 7: Docker deployment

**Files:**
- Create: `/home/matt/fishing-app/docker-compose.yml`
- Create: `/home/matt/fishing-app/app/Dockerfile`
- Create: `/home/matt/fishing-app/.gitignore`

- [ ] **Step 1: Create `Dockerfile`**

Write `/home/matt/fishing-app/app/Dockerfile`:
```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY . .
RUN mkdir -p /app/data
EXPOSE 3001
CMD ["node", "server.js"]
```

- [ ] **Step 2: Create `docker-compose.yml`**

Write `/home/matt/fishing-app/docker-compose.yml`:
```yaml
version: "3.8"

services:
  fishing-app:
    build: ./app
    container_name: fishing-app
    restart: unless-stopped
    ports:
      - "3001:3001"
    environment:
      - PORT=3001
      - DB_PATH=/app/data/db.sqlite
      - UPLOAD_DIR=/app/uploads
      - NODE_ENV=production
    env_file:
      - .env
    volumes:
      - ./data:/app/data
      - /mnt/nas_storage/fishing-app/uploads:/app/uploads
```

- [ ] **Step 3: Create `.gitignore`**

Write `/home/matt/fishing-app/.gitignore`:
```
node_modules/
.env
data/
```

- [ ] **Step 4: Create the NAS upload directory**

```bash
mkdir -p /mnt/nas_storage/fishing-app/uploads
```

- [ ] **Step 5: Generate the admin password hash and create `.env`**

```bash
cd /home/matt/fishing-app/app && node -e "const b=require('bcryptjs');console.log(b.hashSync('REPLACE_WITH_YOUR_PASSWORD',10))"
```

Copy the output hash, then write `/home/matt/fishing-app/.env`:
```
ADMIN_PASSWORD_HASH=<paste hash here>
SESSION_SECRET=<generate a random string, e.g. openssl rand -hex 32>
PORT=3001
UPLOAD_DIR=/app/uploads
DB_PATH=/app/data/db.sqlite
```

- [ ] **Step 6: Build and start the container**

```bash
/usr/local/bin/docker-compose -f /home/matt/fishing-app/docker-compose.yml up -d --build
```

Expected: Container starts, no errors. Check:
```bash
docker logs fishing-app
```
Expected output includes: `Fishing app running on port 3001`

- [ ] **Step 7: Verify the app is accessible**

```bash
curl -s -o /dev/null -w "%{http_code}" http://localhost:3001/
```

Expected: `200`

- [ ] **Step 8: Commit**

```bash
cd /home/matt/fishing-app && git add Dockerfile docker-compose.yml .gitignore .env.example && git commit -m "feat: Docker deployment config"
```

---

## Task 8: Final smoke test and dotenv setup

- [ ] **Step 1: Run full test suite one final time**

```bash
cd /home/matt/fishing-app/app && npm test
```

Expected: All tests PASS, no failures.

- [ ] **Step 2: Install dotenv for local dev**

```bash
cd /home/matt/fishing-app/app && npm install dotenv
```

Confirm `require('dotenv').config()` is already at the top of `server.js` (it is, from Task 1 Step 5).

- [ ] **Step 3: Add `.superpowers/` to the project's `.gitignore`**

In `/home/matt/projects/mattsfapp/.gitignore` (create if needed):
```
.superpowers/
node_modules/
```

- [ ] **Step 4: Final commit**

```bash
cd /home/matt/projects/mattsfapp && git add -A && git commit -m "chore: add gitignore for brainstorm artifacts"
```

---

## Done

At this point the app is running at `http://10.0.0.44:3001` on the LAN.

- Public site: `http://10.0.0.44:3001/`
- Admin panel: `http://10.0.0.44:3001/admin`
- Login with the password you set in `.env`
