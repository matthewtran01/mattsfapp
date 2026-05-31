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
