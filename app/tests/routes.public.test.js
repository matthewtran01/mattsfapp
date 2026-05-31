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
