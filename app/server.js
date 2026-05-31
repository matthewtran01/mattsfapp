require('dotenv').config();
const express = require('express');
const session = require('express-session');
const methodOverride = require('method-override');
const ejsLayouts = require('express-ejs-layouts');
const path = require('path');

const app = express();

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(ejsLayouts);
app.set('layout', 'layout');

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(methodOverride('_method'));
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', (req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  next();
}, express.static(process.env.UPLOAD_DIR || path.join(__dirname, 'uploads')));

app.use(session({
  secret: process.env.SESSION_SECRET || 'dev-secret',
  resave: false,
  saveUninitialized: false,
  cookie: { secure: false }
}));

const { createDb } = require('./db');
const dbPath = process.env.DB_PATH || path.join(__dirname, 'data', 'db.sqlite');
if (process.env.NODE_ENV !== 'test') {
  const db = createDb(dbPath);
  app.locals.db = db;
}

const publicRoutes = require('./routes/public');
const adminRoutes = require('./routes/admin');

app.use('/', publicRoutes);
app.use('/admin', adminRoutes);

const PORT = process.env.PORT || 3001;

if (require.main === module) {
  app.listen(PORT, () => console.log(`Fishing app running on port ${PORT}`));
}

module.exports = app;
