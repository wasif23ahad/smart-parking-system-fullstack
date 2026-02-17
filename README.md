# 🚗 Smart Car Parking Monitoring & Alert System

A full-stack monitoring platform for commercial parking facilities. Built with **Django + DRF** (Backend) and **React + Vite** (Frontend).

## Overview

This system simulates a real-world parking facility where multiple parking zones and slots are monitored through connected devices that continuously send operational data. The software ingests telemetry data, processes it using business logic, detects abnormal conditions, and presents insights in a live monitoring dashboard.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend | Django 4.2, Django REST Framework |
| Frontend | React 18, Vite, Recharts |
| Database | SQLite (development) |
| Styling | Vanilla CSS |

## Project Structure

```
smart-parking-system/
├── backend/                  # Django project
│   ├── config/               # Django settings, URLs, WSGI
│   ├── parking/              # Main app (models, views, services)
│   │   ├── management/       # Custom management commands
│   │   ├── models.py         # Data models
│   │   ├── serializers.py    # DRF serializers
│   │   ├── services.py       # Business logic
│   │   ├── views.py          # API views
│   │   └── urls.py           # URL routing
│   ├── manage.py
│   └── requirements.txt
├── frontend/                 # React app (Vite)
│   ├── src/
│   │   ├── components/       # Reusable UI components
│   │   ├── pages/            # Page components
│   │   ├── services/         # API client
│   │   └── App.jsx
│   └── package.json
└── README.md
```

## Setup Instructions

### Backend

```bash
cd backend
python -m venv venv
venv\Scripts\activate          # Windows
# source venv/bin/activate     # macOS/Linux
pip install -r requirements.txt
python manage.py migrate
python manage.py seed_data
python manage.py runserver
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

## Features

- [ ] Telemetry data ingestion (single & bulk)
- [ ] Parking occupancy logging
- [ ] Dashboard summary API with zone metrics
- [ ] Alert detection & management
- [ ] Device health scoring
- [ ] Parking target vs efficiency calculation
- [ ] Live monitoring dashboard (React)
- [ ] Performance visualization charts
- [ ] Filtering, sorting, search & export

## Assumptions & Thresholds

> Details will be documented as features are implemented.

## Scalability Discussion

> To be added in final submission.
