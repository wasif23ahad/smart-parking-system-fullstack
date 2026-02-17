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
- 1 Facility ("City Center Mall Parking"), 4 Zones, 50 Slots/Devices
- ~14,400 telemetry records (24 hours × 288 intervals × 50 devices)
- Random parking log events (3–12 per device)
- Daily targets for today and yesterday across all zones
- 5 sample alerts (DEVICE_OFFLINE, HIGH_POWER, INVALID_DATA, LOW_HEALTH — including 1 acknowledged)

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

**Data flow:** IoT devices → `POST /api/telemetry/` → Validation → DB write → Inline alert detection → Health score recomputation → Dashboard polling (10s) → React UI.

---

## Data Models

| Model | Purpose | Key Fields |
|-------|---------|------------|
| **ParkingFacility** | Physical parking site | `name`, `address`, `is_active` |
| **ParkingZone** | Zone within a facility | FK `facility`, `name`, `zone_type` (BASEMENT/OUTDOOR/VIP/ROOFTOP), `total_slots` |
| **ParkingSlot** | Individual slot within a zone | FK `zone`, `slot_number`, `is_active` |
| **Device** | IoT sensor attached to a slot | OneToOne `slot`, `device_code` (unique, indexed), `health_score` (0–100), `last_seen_at` |
| **TelemetryData** | Time-series electrical readings | FK `device`, `voltage`, `current`, `power_factor`, `power_consumption` (computed), `timestamp` |
| **ParkingLog** | Occupancy state changes | FK `device`, `is_occupied`, `timestamp` |
| **Alert** | System-generated alerts | FK `device` (nullable), FK `zone` (nullable), `alert_type`, `severity`, `message`, `is_acknowledged` |
| **ParkingTarget** | Daily target per zone | FK `zone`, `date`, `target_occupancy_count`, `target_usage_hours` |

### Key Constraints
- `TelemetryData`: `unique_together = ['device', 'timestamp']` — plus a **1-minute sliding window** duplicate check in the serializer
- `Device.device_code`: globally unique and indexed
- `ParkingTarget`: `unique_together = ['zone', 'date']`
- `ParkingZone`: `unique_together = ['facility', 'name']`
- `ParkingSlot`: `unique_together = ['zone', 'slot_number']`

---

## API Endpoints

| Method | Endpoint | Query Parameters | Description |
|--------|----------|-----------------|-------------|
| POST | `/api/telemetry/` | — | Ingest single telemetry record |
| POST | `/api/telemetry/bulk/` | — | Ingest multiple telemetry records |
| POST | `/api/parking-log/` | — | Record parking occupancy event |
| GET | `/api/dashboard/summary/` | `date`, `facility` | Dashboard aggregate summary |
| GET | `/api/dashboard/hourly/` | `date`, `zone` | 24-hour parking usage with target & last week |
| GET | `/api/alerts/` | `severity`, `type`, `acknowledged` | List alerts |
| PATCH | `/api/alerts/<id>/acknowledge/` | — | Acknowledge a single alert |
| GET | `/api/facilities/` | — | List parking facilities |
| GET | `/api/zones/` | `facility` | List zones |
| GET | `/api/devices/` | `zone`, `active`, `search` | List devices |
| GET | `/api/parking-logs/` | `zone`, `date` | List parking logs |
| GET | `/api/targets/` | `date` | List targets with efficiency |

Full API documentation with request/response examples is available in [API_DOCUMENTATION.md](API_DOCUMENTATION.md).

---

## Business Logic & Thresholds

### Alert Detection

Alerts are triggered inline after each telemetry ingestion (`run_all_detections`) and via a manual/scheduled scan (`detect_offline_devices`):

| Alert Type | Condition | Severity | Trigger |
|------------|-----------|----------|---------|
| **DEVICE_OFFLINE** | No data received for > 2 minutes | CRITICAL | `detect_offline_devices()` |
| **HIGH_POWER** | `power_consumption` > 1,500W | WARNING | Inline after telemetry save |
| **INVALID_DATA** | Voltage < 100V or > 300V | WARNING | Inline after telemetry save |
| **LOW_HEALTH** | Device `health_score` < 30 | INFO | Inline after health recompute |

### Duplicate Alert Prevention

Before creating any alert, the system checks if an **unacknowledged** alert of the same `alert_type` already exists for the same `device`. If it does, no new alert is created. This prevents alert storms during sustained fault conditions.

### Telemetry Duplicate Prevention

A **1-minute sliding window** is enforced at ingestion time: if a telemetry record already exists for the same device within ±1 minute of the incoming timestamp, the request is rejected with a 400 error.

### Efficiency Calculation

- Each zone has a daily `ParkingTarget` with an expected `target_occupancy_count`
- Actual usage = count of `ParkingLog` records with `is_occupied=True` for that zone on that date
- **Efficiency % = (actual_usage / target_occupancy_count) × 100**
- Calculated per-zone and overall in the dashboard summary, and per-target in the targets API

---

## Device Health Score

Each device has a health score from **0 to 100**, recomputed every time new telemetry is ingested. Computed as a weighted sum of four factors:

| Factor | Weight | Scoring Logic |
|--------|--------|---------------|
| **Recency** | 40% | 100 if last seen ≤ 2 min ago. Linear decay 100→0 over 2–60 min. 0 if > 60 min. |
| **Voltage Stability** | 20% | 100 if avg voltage 200–250V; 60 if 150–200V or 250–300V; 20 otherwise |
| **Power Normality** | 20% | 100 if avg power ≤ 1,500W; 50 if ≤ 2,250W; 10 otherwise |
| **Open Alerts** | 20% | 100 if 0 unacknowledged alerts; 60 if ≤ 2; 20 if > 2 |

**Formula:** `score = recency × 0.40 + voltage × 0.20 + power × 0.20 + alerts × 0.20`

Voltage and power scores are based on **1-hour rolling averages** of recent telemetry data.

---

## Completed Features

### Backend
- [x] 8 data models with all PRD-required fields and constraints
- [x] `POST /api/telemetry/` — device validation, future timestamp rejection, 1-minute duplicate window
- [x] `POST /api/telemetry/bulk/` — per-record validation, partial success support
- [x] `POST /api/parking-log/` — occupancy event recording with validation
- [x] `GET /api/dashboard/summary/` — total events, occupancy, active devices, alerts (by severity), efficiency, zone breakdown — with `facility` filter
- [x] `GET /api/dashboard/hourly/` — 24-hour array with `occupied_events`, `target` (from ParkingTarget), `last_week` (real data from 7 days ago)
- [x] Alert detection: 4 types (DEVICE_OFFLINE, HIGH_POWER, INVALID_DATA, LOW_HEALTH)
- [x] Alert severity levels (INFO / WARNING / CRITICAL)
- [x] Duplicate alert prevention (dedup on unacknowledged alerts per device+type)
- [x] Alert acknowledgement API (`PATCH /api/alerts/<id>/acknowledge/`)
- [x] Device health scoring (weighted 0–100 formula, recomputed on each telemetry)
- [x] Parking target & efficiency calculation (per zone, per day)
- [x] Management command `seed_data` for populating realistic sample data
- [x] Django Admin registration for all 8 models
- [x] Comprehensive API documentation

### Frontend
- [x] **Dashboard** — 4 stats cards, zone table, alerts panel, performance chart
- [x] **Dashboard filters** — date picker, facility dropdown (server-side filtering)
- [x] **Performance chart** — Hourly Usage (real) vs Hourly Target (real) vs Last Week (real) — all from API
- [x] **Live Monitoring** — device table with 10-second polling, search, zone/facility filter, active-only toggle
- [x] **Column sorting** — clickable headers with asc/desc toggle on Monitoring and Reports pages
- [x] **Alert Management** — list with severity/type/search/acknowledged filters, acknowledge single + all, export dropdown (CSV/Excel/PDF)
- [x] **Reports** — 3 tabs (Zone Performance, Device Health, Efficiency vs Target), filters, sorting, export
- [x] **Export** — CSV, Excel (XLSX), PDF across Alerts and Reports pages
- [x] **Status indicators** — color-coded badges (OK/Warning/Critical) and health score progress bars
- [x] **Dark-themed UI** — Tailwind CSS with green accent, responsive layout
- [x] **Live status bar** — pulsing "LIVE MONITORING ACTIVE" indicator, polling interval, system load, last-synced timestamp

---

## Incomplete / Partial Features

- **WebSocket real-time updates**: Currently using HTTP polling (10s). WebSocket would reduce latency and server load.
- **Periodic offline device scan**: `detect_offline_devices()` function exists in `services.py` but is not wired to a scheduler (e.g., Celery Beat). It must be called manually or triggered externally.
- **Authentication**: No auth layer. In production, JWT or session-based auth would be required.
- **Frontend pagination**: Backend limits list results to 200 items. Server-side pagination with page controls is not yet implemented.

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
| Frontend | React 19, TypeScript, Vite 7 |
| Styling | Tailwind CSS 4 |
| Charts | Recharts (ComposedChart, Area, Line) |
| State/Data | TanStack React Query (10s polling) |
| Database | PostgreSQL (Neon cloud) |
| Export | jsPDF + jspdf-autotable, xlsx, file-saver |
| Icons | Lucide React |
| Dates | date-fns |

---

## Project Structure

```
smart-parking-system/
├── README.md                    # This file
├── API_DOCUMENTATION.md         # Detailed API docs with examples
├── backend/
│   ├── manage.py
│   ├── requirements.txt
│   ├── config/                  # Django settings, URLs, WSGI
│   │   ├── settings.py
│   │   ├── urls.py
│   │   └── wsgi.py
│   └── parking/                 # Main app
│       ├── models.py            # 8 data models
│       ├── serializers.py       # Request/response serializers with validation
│       ├── views.py             # 12 API views
│       ├── services.py          # Alert detection & health scoring logic
│       ├── urls.py              # URL routing (12 patterns)
│       ├── admin.py             # Django admin registration (all models)
│       ├── migrations/          # Database migrations
│       └── management/commands/
│           └── seed_data.py     # Sample data seeding command
└── frontend/
    ├── package.json
    ├── vite.config.ts
    ├── tailwind.config.js
    ├── index.html
    └── src/
        ├── App.tsx              # Router setup (4 routes)
        ├── main.tsx             # React entry point
        ├── pages/
        │   ├── DashboardPage.tsx   # Stats, zones, alerts, chart
        │   ├── MonitoringPage.tsx  # Live device monitoring
        │   ├── AlertsPage.tsx      # Alert management + export
        │   └── ReportsPage.tsx     # 3-tab reports with export
        ├── components/
        │   ├── PerformanceChart.tsx # Recharts hourly chart
        │   ├── ZoneTable.tsx       # Zone performance table
        │   ├── AlertsPanel.tsx     # Compact alert panel
        │   ├── StatsCard.tsx       # Metric card component
        │   └── StatusBadge.tsx     # Color-coded status badge
        ├── layouts/
        │   └── MainLayout.tsx      # Header, nav, status bar, footer
        └── lib/
            ├── api.ts              # Axios instance
            ├── services.ts         # API service functions + types
            ├── hooks.ts            # React Query hooks (polling)
            ├── exportUtils.ts      # CSV/Excel/PDF export utilities
            ├── utils.ts            # Helper functions (cn)
            └── queryProvider.tsx    # React Query provider
```
