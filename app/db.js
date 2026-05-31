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

// NOTE: All fields must be provided — this is a full-replace update.
// Callers must fetch the existing record first and merge any partial changes.
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

// NOTE: All fields must be provided — this is a full-replace update.
// Callers must fetch the existing record first and merge any partial changes.
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
