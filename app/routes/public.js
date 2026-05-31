const express = require('express');
const router = express.Router();
const { getCatches, getCatch, getUpcomingEvents, insertRsvp, getRsvpsForEvent } = require('../db');

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
  if (location) catches = catches.filter(c => (c.location_name || '').toLowerCase().includes(location.toLowerCase()));
  const allCatches = getCatches(db);
  const allSpecies = [...new Set(allCatches.map(c => c.species))].sort();
  const allLocations = [...new Set(allCatches.map(c => c.location_name).filter(Boolean))].sort();
  res.render('gallery', { catches, allSpecies, allLocations, filter: { species: species || '', location: location || '' } });
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
  const trimmedName = name ? name.trim() : '';
  if (event_id && trimmedName && trimmedName.length <= 80) {
    insertRsvp(db, event_id, trimmedName);
  }
  res.redirect('/calendar');
});

router.get('/about', (req, res) => {
  res.render('about');
});

module.exports = router;
