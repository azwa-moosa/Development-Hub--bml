# BML Development Hub v4

A front-end prototype for the BML People Development Hub, covering Flash Mentoring, Coaching, and Growth Mentorship workflows.

## Overview

This app provides a role-based development hub experience for staff, mentors, and HR administrators. It includes:

- Flash Mentoring and coaching management
- Growth Mentorship batch workflows
- Provider directory and role-based filtering
- Booking and availability oversight
- Audit trail tracking
- Excel-compatible export support

## Tech stack

- HTML
- CSS
- Vanilla JavaScript

## Project structure

- `index.html` — app entry point
- `styles.css` — styling and layout
- `app.js` — business logic and UI state
- `README.md` — project documentation

## Run locally

Open `index.html` directly in a browser, or serve the folder with a lightweight local server:

```bash
cd /path/to/bml-development-hub-v4
python3 -m http.server 8000
```

Then visit:

```text
http://localhost:8000
```

## Notes

This is a prototype and still uses browser `localStorage` for persistence. Production integration points are annotated in the application code and include:

- authentication / role mapping
- notification delivery integration
- database-backed persistence
- external photo storage

## Repository

- GitHub: https://github.com/azwa-moosa/Development-Hub--bml.git
