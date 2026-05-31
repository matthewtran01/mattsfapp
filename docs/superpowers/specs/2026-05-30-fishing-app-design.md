# Matt's Fishing App — Design Spec

**Date:** 2026-05-30  
**Status:** Approved

---

## Overview

A personal fishing blog and scheduling app for Matt and his friends. The primary focus is showcasing fish catches (photos, species, location) and coordinating fishing trips via a shared calendar. No user accounts are required in this phase — the app is blog-style with a single password-protected admin panel. The architecture is designed to allow user accounts to be added in a future phase.

---

## Architecture

- **Runtime:** Node.js + Express
- **Templating:** EJS (server-rendered HTML)
- **Database:** SQLite (via `better-sqlite3`)
- **File uploads:** Multer
- **Maps:** Leaflet.js + OpenStreetMap (free, no API key)
- **Auth:** Single admin password stored as bcrypt hash in `.env`
- **Deployment:** Single Docker container, own `docker-compose.yml` at `/home/matt/fishing-app/`
- **Port:** `3001` (no conflict with existing services)
- **Photo storage:** Volume-mounted at `/mnt/nas_storage/fishing-app/uploads`
- **DB file:** Volume-mounted at `/home/matt/fishing-app/data/db.sqlite`

---

## Visual Style

Rustic / outdoorsy aesthetic:
- Dark greens and earthy browns as primary colors
- Serif fonts (e.g., Georgia) for headings
- Warm amber/gold accents
- Photos presented prominently with minimal chrome

---

## Public Pages (no login required)

### Home (`/`)
- Recent catches feed: photo thumbnail, fish species, lake/location name, date caught
- Upcoming events teaser (next 2–3 events)

### Gallery (`/gallery`)
- Responsive photo grid of all catches
- Filter controls by species and/or location name

### Catch Detail (`/catches/:id`)
- Full-size photo
- Species, location name, date, weight (oz), length (in), notes
- Leaflet.js map with a pin at the catch coordinates

### Calendar (`/calendar`)
- List or simple month view of upcoming fishing events
- Each event shows title, date/time, location
- "I'm in" button — visitor enters their name, no account required
- Shows count of RSVPs per event (and names if clicked/expanded)

### About (`/about`)
- Static page about Matt and the crew

---

## Admin Panel (`/admin`)

### Auth
- `GET /admin/login` — login form
- `POST /admin/login` — validates password against bcrypt hash, sets session cookie
- `GET /admin/logout` — clears session
- All `/admin/*` routes (except login) require valid session

### Catches
- List all catches with edit/delete actions
- `GET /admin/catches/new` — form: photo upload, species, location name, lat/lng (click-to-pin on Leaflet map), date, weight_oz, length_in, notes
- `POST /admin/catches` — save new catch
- `GET /admin/catches/:id/edit` — prefilled edit form
- `POST /admin/catches/:id` — update catch (method override for PUT)
- `POST /admin/catches/:id/delete` — delete catch + photo file

### Events
- List all events with edit/delete actions
- `GET /admin/events/new` — form: title, description, location name, lat/lng (map pin), event date/time
- `POST /admin/events` — save new event
- `GET /admin/events/:id/edit` — prefilled edit form
- `POST /admin/events/:id` — update event
- `POST /admin/events/:id/delete` — delete event + its RSVPs

### RSVPs
- Viewable per event on the event detail/edit page
- No admin creation; RSVPs come from public calendar page only

---

## Data Model

### `catches`
| Column | Type | Notes |
|---|---|---|
| id | INTEGER PK | autoincrement |
| photo_path | TEXT | relative path under uploads dir |
| species | TEXT | e.g. "Largemouth Bass" |
| location_name | TEXT | e.g. "Lake Quinsigamond" |
| lat | REAL | nullable |
| lng | REAL | nullable |
| caught_at | TEXT | ISO date string |
| weight_oz | INTEGER | nullable |
| length_in | INTEGER | nullable |
| notes | TEXT | nullable |
| created_at | TEXT | ISO datetime, default now |

### `events`
| Column | Type | Notes |
|---|---|---|
| id | INTEGER PK | autoincrement |
| title | TEXT | |
| description | TEXT | nullable |
| location_name | TEXT | nullable |
| lat | REAL | nullable |
| lng | REAL | nullable |
| event_at | TEXT | ISO datetime |
| created_at | TEXT | ISO datetime, default now |

### `rsvps`
| Column | Type | Notes |
|---|---|---|
| id | INTEGER PK | autoincrement |
| event_id | INTEGER | FK → events.id |
| name | TEXT | visitor-entered name |
| created_at | TEXT | ISO datetime, default now |

---

## Deployment

### Docker
```
/home/matt/fishing-app/
  docker-compose.yml
  data/              ← SQLite DB (host-mounted)
  app/               ← application source
```

`docker-compose.yml` uses `/usr/local/bin/docker-compose`.  
Container runs on port `3001`.  
Photos volume: `/mnt/nas_storage/fishing-app/uploads` → `/app/uploads` inside container.

### Environment Variables (`.env`)
```
ADMIN_PASSWORD_HASH=<bcrypt hash>
SESSION_SECRET=<random string>
PORT=3001
```

---

## Future Considerations (out of scope for this phase)

- User accounts (for RSVP with profile, trip history)
- Friend profiles / crew pages
- Comments on catches
- Homepage dashboard widget integration (port 3001 is already accessible on LAN)
