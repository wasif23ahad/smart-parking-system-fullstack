# Smart Car Parking Monitoring & Alert System

A full-stack parking facility monitoring platform built with **Django + DRF** (Backend) and **React + TypeScript** (Frontend). The system ingests telemetry and occupancy data from IoT devices, detects abnormal conditions, computes efficiency metrics, and presents everything in a real-time monitoring dashboard.

---

## Table of Contents

- [Setup Instructions](#setup-instructions)
- [Architecture Overview](#architecture-overview)
- [Data Models](#data-models)
- [API Endpoints](#api-endpoints)
- [Business Logic & Thresholds](#business-logic--thresholds)
- [Device Health Score](#device-health-score)
- [Completed Features](#completed-features)
- [Incomplete / Partial Features](#incomplete--partial-features)
- [What I Would Implement Next](#what-i-would-implement-next)
- [Scalability Thought Exercise](#scalability-thought-exercise)

---

## Setup Instructions

### Prerequisites

- Python 3.10+
- Node.js 18+
- PostgreSQL (or configure SQLite by changing `settings.py`)

### Backend Setup

```bash
cd backend

# Create and activate virtual environment
python -m venv venv
venv\Scripts\activate        # Windows
# source venv/bin/activate   # macOS/Linux

# Install dependencies
pip install -r requirements.txt

# Apply migrations
python manage.py migrate

# Seed the database with realistic sample data
python manage.py seed_data

# Start the development server
python manage.py runserver
```

The backend runs at **http://localhost:8000**. The seed command creates:
- 1 Facility, 4 Zones, 50 Slots/Devices
- ~14,400 telemetry records (24 hours × 5-min intervals × 50 devices)
- ~350 parking log events
- Daily targets for all zones
- 5 sample alerts (various types and severities)

### Frontend Setup

```bash
cd frontend

# Install dependencies
npm install

# Start the development server
npm run dev
```

The frontend runs at **http://localhost:5173**.

### Environment Variables (Optional)

The backend reads database credentials from environment variables (or `.env` file in the `backend/` directory):

```env
DB_NAME=neondb
DB_USER=neondb_owner
DB_PASSWORD=your_password
DB_HOST=your_host
DB_PORT=5432
```

If no `.env` is provided, fallback values in `settings.py` are used.

---

## Architecture Overview

```
┌──────────────────────┐         ┌──────────────────────┐
│   React Frontend     │  HTTP   │   Django Backend     │
│   (Vite + TS)        │◄───────►│   (DRF REST API)     │
│                      │  JSON   │                      │
│  • Dashboard         │         │  • Telemetry Ingest  │
│  • Live Monitoring   │         │  • Alert Detection   │
│  • Alert Management  │         │  • Health Scoring    │
│  • Reports & Export  │         │  • Efficiency Calc   │
└──────────────────────┘         └──────────┬───────────┘
                                            │
                                 ┌──────────▼───────────┐
                                 │   PostgreSQL DB       │
                                 │   (Neon / Local)      │
                                 └──────────────────────┘
```

---

## Data Models

| Model | Purpose |
|-------|---------|
| **ParkingFacility** | Physical parking site (name, address) |
| **ParkingZone** | Zone within a facility (Basement-1, VIP, etc.) with zone type |
| **ParkingSlot** | Individual parking slot within a zone |
| **Device** | IoT sensor/controller attached to a slot — tracks `health_score`, `last_seen_at` |
| **TelemetryData** | Time-series voltage/current/power readings from devices |
| **ParkingLog** | Occupancy state changes (occupied/free) per device |
| **Alert** | System-generated alerts with severity (INFO/WARNING/CRITICAL) |
| **ParkingTarget** | Daily target occupancy per zone for efficiency calculation |

### Key Constraints
- `TelemetryData` has `unique_together = ['device', 'timestamp']` to prevent duplicates
- `Device.device_code` is globally unique and indexed
- `ParkingTarget` has `unique_together = ['zone', 'date']`

---

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/telemetry/` | Ingest single telemetry record |
| POST | `/api/telemetry/bulk/` | Ingest multiple telemetry records |
| POST | `/api/parking-log/` | Record occupancy event |
| GET | `/api/dashboard/summary/?date=YYYY-MM-DD` | Dashboard aggregate summary |
| GET | `/api/dashboard/hourly/?date=&zone=` | Hourly parking usage |
| GET | `/api/alerts/` | List alerts (filter: severity, type, acknowledged) |
| PATCH | `/api/alerts/<id>/acknowledge/` | Acknowledge a single alert |
| GET | `/api/facilities/` | List parking facilities |
| GET | `/api/zones/?facility=` | List zones |
| GET | `/api/devices/?zone=&active=&search=` | List devices |
| GET | `/api/parking-logs/?zone=&date=` | List parking logs |
| GET | `/api/targets/?date=` | List targets with efficiency |

Full API documentation is available in [API_DOCUMENTATION.md](API_DOCUMENTATION.md).

---

## Business Logic & Thresholds

### Alert Detection

Alerts are triggered inline after each telemetry ingestion and via periodic checks:

| Alert Type | Condition | Severity |
|------------|-----------|----------|
| **Device Offline** | No data received for > 2 minutes | CRITICAL |
| **High Power** | Power consumption > 1,500W | WARNING |
| **Invalid Data** | Voltage outside 100–300V range | WARNING |
| **Low Health** | Device health score < 30 | INFO |

### Duplicate Alert Prevention

The system checks for existing unacknowledged alerts of the same type for the same device before creating a new one. This prevents alert storms (e.g., repeated "device offline" alerts every polling cycle).

### Efficiency Calculation

- Each zone has a daily `ParkingTarget` with an expected occupancy count
- Actual usage = count of `ParkingLog` records with `is_occupied=True` for that zone on that date
- **Efficiency % = (actual_usage / target_occupancy_count) × 100**
- These metrics are included in the dashboard summary and the targets API

---

## Device Health Score

Each device has a health score from **0 to 100**, computed as a weighted sum of four factors:

| Factor | Weight | Logic |
|--------|--------|-------|
| **Recency** | 40% | Full marks if data received within 2 min. Linear decay from 100→0 over 2–60 minutes. 0 if >60 min. |
| **Voltage Stability** | 20% | 100 if avg voltage is 200–250V; 60 if 150–200V or 250–300V; 20 otherwise |
| **Power Normality** | 20% | 100 if avg power ≤ 1500W; 50 if ≤ 2250W; 10 otherwise |
| **Open Alerts** | 20% | 100 if 0 unacknowledged alerts; 60 if ≤ 2; 20 if > 2 |

**Formula:** `score = recency × 0.40 + voltage × 0.20 + power × 0.20 + alerts × 0.20`

The score is recomputed and persisted every time new telemetry is ingested, ensuring it always reflects the latest device state.

---

## Completed Features

### Backend (All Complete)
- [x] Data models: Facility, Zone, Slot, Device, Telemetry, ParkingLog, Alert, ParkingTarget
- [x] `POST /api/telemetry/` — device validation, future timestamp rejection, duplicate prevention
- [x] `POST /api/telemetry/bulk/` — per-record validation, partial success support
- [x] `POST /api/parking-log/` — occupancy event recording
- [x] `GET /api/dashboard/summary/` — total events, occupancy, active devices, alerts, efficiency
- [x] `GET /api/dashboard/hourly/` — hourly parking usage with zone filter
- [x] Alert detection: device offline, high power, invalid data, low health
- [x] Alert severity levels (INFO / WARNING / CRITICAL)
- [x] Duplicate alert prevention (dedup on unacknowledged alerts)
- [x] Alert acknowledgement API
- [x] Device health scoring (0–100, weighted formula)
- [x] Parking target & efficiency calculation (per zone, per day)
- [x] Management command for seeding realistic data (`seed_data`)
- [x] Django Admin registration for all models
- [x] Comprehensive API documentation

### Frontend (All Complete)
- [x] Dashboard with summary cards (events, occupancy, devices, alerts)
- [x] Zone-wise performance table with occupancy bars and efficiency indicators
- [x] Performance chart (Hourly Usage vs Target — Recharts ComposedChart)
- [x] Live monitoring page with 10-second polling
- [x] Device status (Online/Offline), health score bars, last-seen timestamps
- [x] Alert management panel — list, filter by severity/zone, acknowledge, acknowledge all
- [x] Reports page with 3 tabs: Zone Performance, Device Health, Efficiency vs Target
- [x] Filters: facility, zone, date range, text search
- [x] Client-side column sorting (ascending/descending)
- [x] Export: CSV, Excel (XLSX), PDF — fully wired
- [x] Status indicators (OK / Warning / Critical) color-coded throughout
- [x] Responsive dark-themed UI with Tailwind CSS

---

## Incomplete / Partial Features

- **WebSocket real-time updates**: Currently using HTTP polling (10s). WebSocket would reduce latency.
- **Periodic offline device scan**: `detect_offline_devices()` exists but is not wired to a scheduler (e.g., Celery Beat). It runs on-demand.
- **Authentication**: No auth layer. In production, JWT or session-based auth would be required.
- **Pagination on frontend**: Backend has DRF pagination configured but frontend lists are capped at 200 items.

---

## What I Would Implement Next

Given more time, I would prioritize:

1. **Celery + Redis integration** — Schedule `detect_offline_devices()` to run every 2 minutes via Celery Beat, and move heavy health-score computations to async tasks.
2. **WebSocket via Django Channels** — Replace polling with real-time push for device status, alerts, and dashboard updates.
3. **Authentication & RBAC** — JWT auth with role-based access (admin, operator, viewer).
4. **Time-series database integration** — Move telemetry data to TimescaleDB or InfluxDB for better query performance at scale.
5. **Historical trend charts** — Weekly/monthly occupancy trends, device health degradation over time.
6. **Geospatial visualization** — Interactive parking lot map showing slot status in real time.
7. **Automated alert escalation** — If a CRITICAL alert is not acknowledged within 15 minutes, notify via email/SMS.
8. **Unit & integration tests** — Comprehensive test suite for serializers, services, and views.

---

## Scalability Thought Exercise

> **"What changes would you make if this system had 5,000 devices sending data every 10 seconds?"**

That's **500 telemetry writes/second** sustained, or **43.2 million records/day**. Here's how I would adapt the architecture:

### 1. Message Queue for Ingestion
Replace direct HTTP-to-database writes with a **message broker** (Kafka or RabbitMQ). Devices publish telemetry to a topic; backend workers consume and batch-insert, decoupling ingestion throughput from database write speed.

### 2. Time-Series Database
Move telemetry storage from PostgreSQL to **TimescaleDB** (Postgres extension) or **InfluxDB**. These are optimized for high-volume time-series writes, automatic data partitioning (chunking by time), and fast aggregate queries (hourly averages, max values).

### 3. Database Write Optimization
- **Bulk inserts**: Batch incoming records (e.g., 500 at a time) instead of row-by-row.
- **Connection pooling**: Use PgBouncer to handle concurrent connections efficiently.
- **Data retention policies**: Auto-archive or delete telemetry older than 90 days; keep only aggregated summaries for historical analysis.

### 4. Async Task Processing
Use **Celery workers** (horizontally scalable) to:
- Run alert detection asynchronously instead of inline.
- Compute health scores in batch (e.g., every 30 seconds for all devices) rather than per-ingestion.
- Pre-compute dashboard aggregates and cache them.

### 5. Caching Layer
Add **Redis** for:
- Caching dashboard summary (TTL: 10s) to avoid recalculating on every request.
- Storing "last_seen_at" per device in memory (faster than DB updates).
- Rate-limiting API calls per device to prevent abuse.

### 6. Horizontal Scaling
- **Stateless Django behind a load balancer** (Nginx / AWS ALB) — spin up multiple app servers.
- **Read replicas** for PostgreSQL — route dashboard/report queries to replicas.
- **Kubernetes** for auto-scaling workers based on queue depth.

### 7. WebSocket for Frontend
Replace 10-second polling with **WebSocket push** (Django Channels + Redis). At 5,000 devices, polling creates massive redundant API traffic. Push only changed data.

### 8. Data Aggregation Pipeline
Instead of querying raw telemetry for dashboards, run a **5-minute aggregation job** that computes min/max/avg per device and stores it in a summary table. Dashboard queries hit the summary table, which is orders of magnitude smaller.

### Summary
The key architectural shift is from **synchronous request-response** to **event-driven processing**: ingest → queue → batch-write → async-detect → cache → push. This allows the system to scale horizontally at each layer independently.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend | Django 4.2, Django REST Framework |
| Frontend | React 19, TypeScript, Vite |
| Styling | Tailwind CSS 4 |
| Charts | Recharts |
| State/Data | TanStack React Query |
| Database | PostgreSQL (Neon) |
| Export | jsPDF, xlsx, file-saver |

---

## Project Structure

```
smart-parking-system/
├── README.md                    # This file
├── API_DOCUMENTATION.md         # Detailed API docs
├── backend/
│   ├── manage.py
│   ├── requirements.txt
│   ├── config/                  # Django settings, URLs, WSGI
│   └── parking/                 # Main app
│       ├── models.py            # 8 data models
│       ├── serializers.py       # Request/response serializers
│       ├── views.py             # API views (12 endpoints)
│       ├── services.py          # Alert detection & health scoring
│       ├── urls.py              # URL routing
│       ├── admin.py             # Django admin configuration
│       └── management/commands/ # seed_data command
└── frontend/
    ├── package.json
    ├── vite.config.ts
    └── src/
        ├── pages/               # Dashboard, Monitoring, Alerts, Reports
        ├── components/          # Reusable UI components
        └── lib/                 # API client, hooks, services, utilities
```
