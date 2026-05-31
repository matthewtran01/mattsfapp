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

  test('updateEvent modifies row', () => {
    insertEvent(db, { title: 'Trip', description: null, location_name: null,
      lat: null, lng: null, event_at: '2099-06-01T06:00:00' });
    const id = getEvents(db)[0].id;
    updateEvent(db, id, { title: 'Updated Trip', description: null, location_name: null,
      lat: null, lng: null, event_at: '2099-06-01T06:00:00' });
    expect(getEvent(db, id).title).toBe('Updated Trip');
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
