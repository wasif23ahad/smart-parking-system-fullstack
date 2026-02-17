# Smart Car Parking Monitoring & Alert System — API Documentation

## Overview

This document provides comprehensive API documentation for the **Smart Car Parking Monitoring & Alert System**. All request/response examples use realistic device codes from the seed data and match the actual backend implementation exactly.

**Base URL:** `http://localhost:8000`  
**Content-Type:** `application/json`  
**Server Timezone:** UTC  
**Framework:** Django REST Framework (DRF)

### Seed Data Reference

After running `python manage.py seed_data`, the following data is created:

| Entity | Details |
|--------|---------|
| **Facility** | 1 — "City Center Mall Parking" (address: "123 Main Street, Downtown") |
| **Zones** | Basement-1 (20 slots, prefix `B1`), Basement-2 (15 slots, prefix `B2`), Outdoor (10 slots, prefix `OUT`), VIP (5 slots, prefix `VIP`) |
| **Device Code Format** | `PARK-{zone_prefix}-S{number}` → e.g., `PARK-B1-S001`, `PARK-B2-S003`, `PARK-OUT-S010`, `PARK-VIP-S005` |
| **Total Devices** | 50 (one per slot) |
| **Telemetry** | ~14,400 records (288 per device × 50 devices, every 5 min for 24 hours) |
| **Parking Logs** | Random occupancy events for all 50 devices |
| **Targets** | Daily targets for today and yesterday for all 4 zones |
| **Alerts** | 5 sample alerts (DEVICE_OFFLINE, HIGH_POWER, INVALID_DATA, LOW_HEALTH, 1 acknowledged) |

---

## Table of Contents

1. [Data Ingestion APIs](#data-ingestion-apis)
   - [1. Single Telemetry Ingestion](#1-single-telemetry-ingestion)
   - [2. Bulk Telemetry Ingestion](#2-bulk-telemetry-ingestion)
   - [3. Parking Log Event](#3-parking-log-event)
2. [Dashboard APIs](#dashboard-apis)
   - [4. Dashboard Summary](#4-dashboard-summary)
   - [5. Hourly Usage Data](#5-hourly-usage-data)
3. [Alert Management APIs](#alert-management-apis)
   - [6. List Alerts](#6-list-alerts)
   - [7. Acknowledge Alert](#7-acknowledge-alert)
4. [Resource APIs](#resource-apis)
   - [8. List Facilities](#8-list-facilities)
   - [9. List Zones](#9-list-zones)
   - [10. List Devices](#10-list-devices)
   - [11. List Parking Logs](#11-list-parking-logs)
   - [12. List Parking Targets](#12-list-parking-targets)
5. [Data Models](#data-models)
6. [Error Handling](#error-handling)
7. [Alert Detection Logic](#alert-detection-logic)
8. [Health Score Calculation](#health-score-calculation)
9. [Postman Collection Quick Reference](#postman-collection-quick-reference)
10. [cURL Examples](#curl-examples)

---

## Data Ingestion APIs

### 1. Single Telemetry Ingestion

Ingests a single telemetry record from an IoT parking sensor. After successful ingestion, the system automatically:
1. Computes `power_consumption` = `voltage × current × power_factor`
2. Updates the device's `last_seen_at` timestamp
3. Runs all inline alert detections (HIGH_POWER, INVALID_DATA, LOW_HEALTH)
4. Recomputes the device health score (0–100)

**Endpoint:** `POST /api/telemetry/`

**Request Headers:**

| Header | Value |
|--------|-------|
| `Content-Type` | `application/json` |

**Request Body Parameters:**

| Field | Type | Required | Constraints | Description |
|-------|------|----------|-------------|-------------|
| `device_code` | string | Yes | Max 50 chars | Unique device identifier. Must match an existing active device (e.g., `PARK-B1-S001`) |
| `voltage` | float | Yes | Any float | Voltage reading in Volts (normal range: 200–250V) |
| `current` | float | Yes | Any float | Current reading in Amperes |
| `power_factor` | float | Yes | 0.0–1.0 | Power factor of the sensor |
| `timestamp` | datetime | Yes | ISO 8601, not future | Timestamp of the reading. Allows up to 5 minutes of clock skew. |

**Validation Rules:**
1. `device_code` must match a `Device` record with `is_active=True`
2. `timestamp` cannot be more than 5 minutes in the future (allows for IoT clock skew)
3. No duplicate telemetry within a **±1 minute window** for the same device

---

#### Sample Request — Successful Ingestion

**Request:**
```http
POST /api/telemetry/
Content-Type: application/json

{
    "device_code": "PARK-B1-S001",
    "voltage": 225.3,
    "current": 4.5,
    "power_factor": 0.92,
    "timestamp": "2026-02-18T03:30:00Z"
}
```

**Response — 201 Created:**
```json
{
    "status": "success",
    "message": "Telemetry data recorded.",
    "device_code": "PARK-B1-S001",
    "power_consumption": 932.24,
    "timestamp": "2026-02-18T03:30:00Z",
    "alerts_triggered": [],
    "health_score": 92
}
```

**Response Fields:**

| Field | Type | Description |
|-------|------|-------------|
| `status` | string | Always `"success"` for 201 |
| `message` | string | `"Telemetry data recorded."` |
| `device_code` | string | Device that received the data |
| `power_consumption` | float | Computed: `voltage × current × power_factor` (225.3 × 4.5 × 0.92 = 932.24) |
| `timestamp` | string | ISO 8601 timestamp of the ingested reading |
| `alerts_triggered` | array | List of alert type strings triggered (empty if none) |
| `health_score` | integer | Updated device health score (0–100) |

---

#### Sample Request — Triggers HIGH_POWER Alert

When `power_consumption` exceeds 1,500W, a HIGH_POWER alert is created.

**Request:**
```http
POST /api/telemetry/
Content-Type: application/json

{
    "device_code": "PARK-B2-S005",
    "voltage": 235.0,
    "current": 7.8,
    "power_factor": 0.95,
    "timestamp": "2026-02-18T03:30:00Z"
}
```

**Response — 201 Created:**
```json
{
    "status": "success",
    "message": "Telemetry data recorded.",
    "device_code": "PARK-B2-S005",
    "power_consumption": 1741.35,
    "timestamp": "2026-02-18T03:30:00Z",
    "alerts_triggered": ["HIGH_POWER"],
    "health_score": 78
}
```

---

#### Sample Request — Triggers INVALID_DATA Alert

When voltage is outside the valid range (< 100V or > 300V), an INVALID_DATA alert is created.

**Request:**
```http
POST /api/telemetry/
Content-Type: application/json

{
    "device_code": "PARK-OUT-S003",
    "voltage": 50.0,
    "current": 3.2,
    "power_factor": 0.90,
    "timestamp": "2026-02-18T03:30:00Z"
}
```

**Response — 201 Created:**
```json
{
    "status": "success",
    "message": "Telemetry data recorded.",
    "device_code": "PARK-OUT-S003",
    "power_consumption": 144.0,
    "timestamp": "2026-02-18T03:30:00Z",
    "alerts_triggered": ["INVALID_DATA"],
    "health_score": 65
}
```

---

#### Error Response — Invalid Device Code

**Request:**
```http
POST /api/telemetry/
Content-Type: application/json

{
    "device_code": "INVALID-DEVICE",
    "voltage": 220.0,
    "current": 1.2,
    "power_factor": 0.95,
    "timestamp": "2026-02-18T03:30:00Z"
}
```

**Response — 400 Bad Request:**
```json
{
    "status": "error",
    "errors": {
        "device_code": [
            "Device with code 'INVALID-DEVICE' does not exist or is inactive."
        ]
    }
}
```

---

#### Error Response — Future Timestamp

**Request:**
```http
POST /api/telemetry/
Content-Type: application/json

{
    "device_code": "PARK-B1-S001",
    "voltage": 220.0,
    "current": 1.2,
    "power_factor": 0.95,
    "timestamp": "2027-12-31T23:59:59Z"
}
```

**Response — 400 Bad Request:**
```json
{
    "status": "error",
    "errors": {
        "timestamp": [
            "Timestamp cannot be in the future."
        ]
    }
}
```

---

#### Error Response — Duplicate Telemetry (1-Minute Window)

If a record already exists for the same device within ±1 minute of the submitted timestamp.

**Request (sent twice with same data):**
```http
POST /api/telemetry/
Content-Type: application/json

{
    "device_code": "PARK-B1-S001",
    "voltage": 225.3,
    "current": 4.5,
    "power_factor": 0.92,
    "timestamp": "2026-02-18T03:30:00Z"
}
```

**Response — 400 Bad Request (second call):**
```json
{
    "status": "error",
    "errors": {
        "non_field_errors": [
            "Duplicate telemetry: a record for this device already exists within a 1-minute window."
        ]
    }
}
```

---

#### Error Response — Missing Required Fields

**Request:**
```http
POST /api/telemetry/
Content-Type: application/json

{
    "device_code": "PARK-B1-S001"
}
```

**Response — 400 Bad Request:**
```json
{
    "status": "error",
    "errors": {
        "voltage": ["This field is required."],
        "current": ["This field is required."],
        "power_factor": ["This field is required."],
        "timestamp": ["This field is required."]
    }
}
```

---

#### Error Response — Multiple Validation Errors

**Request:**
```http
POST /api/telemetry/
Content-Type: application/json

{
    "device_code": "NONEXISTENT",
    "voltage": 220.0,
    "current": 1.2,
    "power_factor": 0.95,
    "timestamp": "2027-12-31T23:59:59Z"
}
```

**Response — 400 Bad Request:**
```json
{
    "status": "error",
    "errors": {
        "device_code": [
            "Device with code 'NONEXISTENT' does not exist or is inactive."
        ],
        "timestamp": [
            "Timestamp cannot be in the future."
        ]
    }
}
```

---

### 2. Bulk Telemetry Ingestion

Ingests multiple telemetry records in a single request. Each record is validated independently — **partial success is supported**. Valid records are saved even if other records fail.

**Endpoint:** `POST /api/telemetry/bulk/`

**Request Headers:**

| Header | Value |
|--------|-------|
| `Content-Type` | `application/json` |

**Request Body:** JSON array of telemetry objects (same fields as single ingestion).

---

#### Sample Request — All Records Succeed

**Request:**
```http
POST /api/telemetry/bulk/
Content-Type: application/json

[
    {
        "device_code": "PARK-B1-S001",
        "voltage": 222.0,
        "current": 4.2,
        "power_factor": 0.93,
        "timestamp": "2026-02-18T02:00:00Z"
    },
    {
        "device_code": "PARK-B1-S002",
        "voltage": 219.5,
        "current": 3.8,
        "power_factor": 0.91,
        "timestamp": "2026-02-18T02:00:00Z"
    }
]
```

**Response — 201 Created:**
```json
{
    "status": "success",
    "created_count": 2,
    "failed_count": 0,
    "created": [
        {
            "device_code": "PARK-B1-S001",
            "timestamp": "2026-02-18T02:00:00Z",
            "power_consumption": 867.37
        },
        {
            "device_code": "PARK-B1-S002",
            "timestamp": "2026-02-18T02:00:00Z",
            "power_consumption": 758.51
        }
    ],
    "errors": []
}
```

---

#### Sample Request — Partial Success (Mixed Valid and Invalid)

**Request:**
```http
POST /api/telemetry/bulk/
Content-Type: application/json

[
    {
        "device_code": "PARK-B1-S003",
        "voltage": 221.0,
        "current": 5.0,
        "power_factor": 0.94,
        "timestamp": "2026-02-18T02:05:00Z"
    },
    {
        "device_code": "INVALID-DEVICE",
        "voltage": 220.0,
        "current": 1.0,
        "power_factor": 0.90,
        "timestamp": "2026-02-18T02:05:00Z"
    },
    {
        "device_code": "PARK-B2-S001",
        "voltage": 218.0,
        "current": 4.3,
        "power_factor": 0.89,
        "timestamp": "2027-12-31T23:59:59Z"
    }
]
```

**Response — 201 Created:**
```json
{
    "status": "success",
    "created_count": 1,
    "failed_count": 2,
    "created": [
        {
            "device_code": "PARK-B1-S003",
            "timestamp": "2026-02-18T02:05:00Z",
            "power_consumption": 1038.7
        }
    ],
    "errors": [
        {
            "index": 1,
            "data": {
                "device_code": "INVALID-DEVICE",
                "voltage": 220.0,
                "current": 1.0,
                "power_factor": 0.90,
                "timestamp": "2026-02-18T02:05:00Z"
            },
            "errors": {
                "device_code": [
                    "Device with code 'INVALID-DEVICE' does not exist or is inactive."
                ]
            }
        },
        {
            "index": 2,
            "data": {
                "device_code": "PARK-B2-S001",
                "voltage": 218.0,
                "current": 4.3,
                "power_factor": 0.89,
                "timestamp": "2027-12-31T23:59:59Z"
            },
            "errors": {
                "timestamp": [
                    "Timestamp cannot be in the future."
                ]
            }
        }
    ]
}
```

**Response Fields:**

| Field | Type | Description |
|-------|------|-------------|
| `status` | string | `"success"` — even with partial failures |
| `created_count` | integer | Number of records successfully created |
| `failed_count` | integer | Number of records that failed validation |
| `created` | array | Array of `{ device_code, timestamp, power_consumption }` for each success |
| `errors` | array | Array of `{ index, data, errors }` for each failure |
| `errors[].index` | integer | Zero-based index of the failed record in the input array |
| `errors[].data` | object | The original submitted record that failed |
| `errors[].errors` | object | DRF validation errors for this record |

---

#### Error Response — Not an Array

**Request:**
```http
POST /api/telemetry/bulk/
Content-Type: application/json

{
    "device_code": "PARK-B1-S001",
    "voltage": 220.0,
    "current": 1.0,
    "power_factor": 0.90,
    "timestamp": "2026-02-18T02:00:00Z"
}
```

**Response — 400 Bad Request:**
```json
{
    "status": "error",
    "errors": {
        "non_field_errors": [
            "Expected a list of telemetry records."
        ]
    }
}
```

---

#### Error Response — Empty Array

**Request:**
```http
POST /api/telemetry/bulk/
Content-Type: application/json

[]
```

**Response — 400 Bad Request:**
```json
{
    "status": "error",
    "errors": {
        "non_field_errors": [
            "The list cannot be empty."
        ]
    }
}
```

---

### 3. Parking Log Event

Records a parking slot occupancy change event. Each event indicates whether a slot has become occupied or has been freed.

**Endpoint:** `POST /api/parking-log/`

**Request Headers:**

| Header | Value |
|--------|-------|
| `Content-Type` | `application/json` |

**Request Body Parameters:**

| Field | Type | Required | Constraints | Description |
|-------|------|----------|-------------|-------------|
| `device_code` | string | Yes | Max 50 chars | Active device identifier (e.g., `PARK-B1-S001`) |
| `is_occupied` | boolean | Yes | `true` / `false` | `true` = slot occupied, `false` = slot freed |
| `timestamp` | datetime | Yes | ISO 8601, not future | When the occupancy event occurred |

---

#### Sample Request — Slot Becomes Occupied

**Request:**
```http
POST /api/parking-log/
Content-Type: application/json

{
    "device_code": "PARK-B1-S001",
    "is_occupied": true,
    "timestamp": "2026-02-18T03:15:00Z"
}
```

**Response — 201 Created:**
```json
{
    "status": "success",
    "message": "Parking log recorded.",
    "device_code": "PARK-B1-S001",
    "is_occupied": true,
    "timestamp": "2026-02-18T03:15:00Z"
}
```

---

#### Sample Request — Slot Becomes Free

**Request:**
```http
POST /api/parking-log/
Content-Type: application/json

{
    "device_code": "PARK-B1-S001",
    "is_occupied": false,
    "timestamp": "2026-02-18T04:30:00Z"
}
```

**Response — 201 Created:**
```json
{
    "status": "success",
    "message": "Parking log recorded.",
    "device_code": "PARK-B1-S001",
    "is_occupied": false,
    "timestamp": "2026-02-18T04:30:00Z"
}
```

---

#### Error Response — Invalid Device

**Request:**
```http
POST /api/parking-log/
Content-Type: application/json

{
    "device_code": "DOES-NOT-EXIST",
    "is_occupied": true,
    "timestamp": "2026-02-18T03:00:00Z"
}
```

**Response — 400 Bad Request:**
```json
{
    "status": "error",
    "errors": {
        "device_code": [
            "Device with code 'DOES-NOT-EXIST' does not exist or is inactive."
        ]
    }
}
```

---

#### Error Response — Future Timestamp

**Request:**
```http
POST /api/parking-log/
Content-Type: application/json

{
    "device_code": "PARK-B1-S001",
    "is_occupied": true,
    "timestamp": "2027-01-01T00:00:00Z"
}
```

**Response — 400 Bad Request:**
```json
{
    "status": "error",
    "errors": {
        "timestamp": [
            "Timestamp cannot be in the future."
        ]
    }
}
```

---

## Dashboard APIs

### 4. Dashboard Summary

Returns a comprehensive aggregated dashboard overview for a specific date. Includes total occupancy, device health, alert counts, efficiency metrics, and a per-zone breakdown.

**Endpoint:** `GET /api/dashboard/summary/`

**Query Parameters:**

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `date` | string | No | Today | Date filter in `YYYY-MM-DD` format |
| `facility` | integer | No | All | Filter all metrics by facility ID |

---

#### Sample Request — Default (Today, All Facilities)

**Request:**
```http
GET /api/dashboard/summary/
```

**Response — 200 OK:**
```json
{
    "date": "2026-02-18",
    "total_slots": 50,
    "total_occupied": 27,
    "total_available": 23,
    "occupancy_rate": 54.0,
    "total_parking_events": 385,
    "active_devices": 50,
    "avg_health_score": 88.3,
    "alerts": {
        "total": 4,
        "critical": 1,
        "warning": 2,
        "info": 1,
        "triggered_on_date": 4
    },
    "efficiency": {
        "target_usage": 40,
        "actual_usage": 385,
        "efficiency_percentage": 962.5
    },
    "zones": [
        {
            "id": 1,
            "name": "Basement-1",
            "zone_type": "BASEMENT",
            "facility_name": "City Center Mall Parking",
            "total_slots": 20,
            "occupied": 11,
            "available": 9,
            "occupancy_rate": 55.0,
            "target_usage": 16,
            "actual_usage": 162,
            "efficiency_percentage": 1012.5
        },
        {
            "id": 2,
            "name": "Basement-2",
            "zone_type": "BASEMENT",
            "facility_name": "City Center Mall Parking",
            "total_slots": 15,
            "occupied": 8,
            "available": 7,
            "occupancy_rate": 53.3,
            "target_usage": 12,
            "actual_usage": 115,
            "efficiency_percentage": 958.3
        },
        {
            "id": 3,
            "name": "Outdoor",
            "zone_type": "OUTDOOR",
            "facility_name": "City Center Mall Parking",
            "total_slots": 10,
            "occupied": 5,
            "available": 5,
            "occupancy_rate": 50.0,
            "target_usage": 8,
            "actual_usage": 72,
            "efficiency_percentage": 900.0
        },
        {
            "id": 4,
            "name": "VIP",
            "zone_type": "VIP",
            "facility_name": "City Center Mall Parking",
            "total_slots": 5,
            "occupied": 3,
            "available": 2,
            "occupancy_rate": 60.0,
            "target_usage": 4,
            "actual_usage": 36,
            "efficiency_percentage": 900.0
        }
    ]
}
```

---

#### Sample Request — With Date and Facility Filter

**Request:**
```http
GET /api/dashboard/summary/?date=2026-02-17&facility=1
```

**Response:** Same structure as above, filtered to facility ID 1 and date 2026-02-17.

---

#### Error Response — Invalid Date Format

**Request:**
```http
GET /api/dashboard/summary/?date=invalid-date
```

**Response — 400 Bad Request:**
```json
{
    "error": "Invalid date format. Use YYYY-MM-DD."
}
```

---

**Response Fields Reference:**

| Field | Type | Description |
|-------|------|-------------|
| `date` | string | The date for which data is returned |
| `total_slots` | integer | Total active parking slots (filtered by facility if provided) |
| `total_occupied` | integer | Currently occupied slots based on each device's latest ParkingLog |
| `total_available` | integer | `total_slots - total_occupied` |
| `occupancy_rate` | float | `(total_occupied / total_slots) × 100`, rounded to 1 decimal |
| `total_parking_events` | integer | Total ParkingLog records for the given date |
| `active_devices` | integer | Count of devices where `is_active=True` |
| `avg_health_score` | float | Average `health_score` across active devices, rounded to 1 decimal |
| `alerts.total` | integer | Total **unacknowledged** alerts (not date-filtered) |
| `alerts.critical` | integer | Unacknowledged CRITICAL severity alerts |
| `alerts.warning` | integer | Unacknowledged WARNING severity alerts |
| `alerts.info` | integer | Unacknowledged INFO severity alerts |
| `alerts.triggered_on_date` | integer | Alerts created on the specified date (regardless of acknowledged status) |
| `efficiency.target_usage` | integer | Sum of `target_occupancy_count` from ParkingTarget for the date |
| `efficiency.actual_usage` | integer | Sum of occupied ParkingLog events across all zones for the date |
| `efficiency.efficiency_percentage` | float | `(actual_usage / target_usage) × 100`, rounded to 1 decimal |
| `zones[]` | array | Per-zone breakdown (see sub-fields below) |
| `zones[].id` | integer | Zone primary key |
| `zones[].name` | string | Zone name (e.g., "Basement-1") |
| `zones[].zone_type` | string | One of: `BASEMENT`, `OUTDOOR`, `VIP`, `ROOFTOP` |
| `zones[].facility_name` | string | Parent facility name |
| `zones[].total_slots` | integer | Total slots in this zone |
| `zones[].occupied` | integer | Currently occupied slots in this zone |
| `zones[].available` | integer | `total_slots - occupied` |
| `zones[].occupancy_rate` | float | Zone-level occupancy percentage |
| `zones[].target_usage` | integer | Zone's daily target occupancy count (0 if no target set) |
| `zones[].actual_usage` | integer | Zone's actual occupied events for the date |
| `zones[].efficiency_percentage` | float | Zone-level efficiency percentage |

---

### 5. Hourly Usage Data

Returns a **24-element array** (one per hour, 00–23) with actual parking usage, target occupancy spread evenly, and the same hour's data from exactly 7 days ago for week-over-week comparison. Used to power the Performance Chart.

**Endpoint:** `GET /api/dashboard/hourly/`

**Query Parameters:**

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `date` | string | No | Today | Date in `YYYY-MM-DD` format |
| `zone` | integer | No | All zones | Filter by specific zone ID |

---

#### Sample Request — Specific Zone and Date

**Request:**
```http
GET /api/dashboard/hourly/?date=2026-02-18&zone=1
```

**Response — 200 OK:**
```json
{
    "date": "2026-02-18",
    "zone_id": "1",
    "hourly": [
        {
            "hour": 0,
            "label": "00:00",
            "occupied_events": 5,
            "target": 0.7,
            "last_week": 3
        },
        {
            "hour": 1,
            "label": "01:00",
            "occupied_events": 2,
            "target": 0.7,
            "last_week": 1
        },
        {
            "hour": 2,
            "label": "02:00",
            "occupied_events": 0,
            "target": 0.7,
            "last_week": 0
        },
        {
            "hour": 3,
            "label": "03:00",
            "occupied_events": 1,
            "target": 0.7,
            "last_week": 2
        },
        {
            "hour": 4,
            "label": "04:00",
            "occupied_events": 0,
            "target": 0.7,
            "last_week": 0
        },
        {
            "hour": 5,
            "label": "05:00",
            "occupied_events": 3,
            "target": 0.7,
            "last_week": 1
        },
        {
            "hour": 6,
            "label": "06:00",
            "occupied_events": 7,
            "target": 0.7,
            "last_week": 5
        },
        {
            "hour": 7,
            "label": "07:00",
            "occupied_events": 12,
            "target": 0.7,
            "last_week": 9
        },
        {
            "hour": 8,
            "label": "08:00",
            "occupied_events": 18,
            "target": 0.7,
            "last_week": 15
        },
        {
            "hour": 9,
            "label": "09:00",
            "occupied_events": 22,
            "target": 0.7,
            "last_week": 19
        },
        {
            "hour": 10,
            "label": "10:00",
            "occupied_events": 25,
            "target": 0.7,
            "last_week": 20
        },
        {
            "hour": 11,
            "label": "11:00",
            "occupied_events": 20,
            "target": 0.7,
            "last_week": 18
        },
        {
            "hour": 12,
            "label": "12:00",
            "occupied_events": 15,
            "target": 0.7,
            "last_week": 14
        },
        {
            "hour": 13,
            "label": "13:00",
            "occupied_events": 17,
            "target": 0.7,
            "last_week": 16
        },
        {
            "hour": 14,
            "label": "14:00",
            "occupied_events": 19,
            "target": 0.7,
            "last_week": 15
        },
        {
            "hour": 15,
            "label": "15:00",
            "occupied_events": 14,
            "target": 0.7,
            "last_week": 12
        },
        {
            "hour": 16,
            "label": "16:00",
            "occupied_events": 10,
            "target": 0.7,
            "last_week": 8
        },
        {
            "hour": 17,
            "label": "17:00",
            "occupied_events": 8,
            "target": 0.7,
            "last_week": 6
        },
        {
            "hour": 18,
            "label": "18:00",
            "occupied_events": 5,
            "target": 0.7,
            "last_week": 4
        },
        {
            "hour": 19,
            "label": "19:00",
            "occupied_events": 3,
            "target": 0.7,
            "last_week": 2
        },
        {
            "hour": 20,
            "label": "20:00",
            "occupied_events": 2,
            "target": 0.7,
            "last_week": 1
        },
        {
            "hour": 21,
            "label": "21:00",
            "occupied_events": 1,
            "target": 0.7,
            "last_week": 0
        },
        {
            "hour": 22,
            "label": "22:00",
            "occupied_events": 0,
            "target": 0.7,
            "last_week": 0
        },
        {
            "hour": 23,
            "label": "23:00",
            "occupied_events": 0,
            "target": 0.7,
            "last_week": 0
        }
    ]
}
```

---

#### Sample Request — All Zones (No Filter)

**Request:**
```http
GET /api/dashboard/hourly/?date=2026-02-18
```

**Response — 200 OK:**
```json
{
    "date": "2026-02-18",
    "zone_id": null,
    "hourly": [
        {
            "hour": 0,
            "label": "00:00",
            "occupied_events": 12,
            "target": 1.7,
            "last_week": 8
        }
    ]
}
```

> **Note:** The `hourly` array always contains exactly 24 elements (hours 0–23). The example above is truncated for brevity.

---

**Response Fields:**

| Field | Type | Description |
|-------|------|-------------|
| `date` | string | The date queried |
| `zone_id` | string/null | Zone ID filter applied, or `null` if all zones |
| `hourly` | array | Always 24 elements, one per hour (00–23) |
| `hourly[].hour` | integer | Hour of the day (0–23) |
| `hourly[].label` | string | Formatted hour label (e.g., `"08:00"`) |
| `hourly[].occupied_events` | integer | Count of `is_occupied=True` ParkingLog records for this hour on the given date |
| `hourly[].target` | float | Daily target (sum of all zone targets) ÷ 24. Constant across all hours. |
| `hourly[].last_week` | integer | Same hour's occupied events from exactly 7 days ago |

---

#### Error Response — Invalid Date

**Request:**
```http
GET /api/dashboard/hourly/?date=not-a-date
```

**Response — 400 Bad Request:**
```json
{
    "error": "Invalid date format. Use YYYY-MM-DD."
}
```

---

## Alert Management APIs

### 6. List Alerts

Returns a list of system alerts with optional filtering by severity, type, and acknowledgment status. Results are ordered by creation date (newest first) and limited to 200 records.

**Endpoint:** `GET /api/alerts/`

**Query Parameters:**

| Parameter | Type | Required | Values | Description |
|-----------|------|----------|--------|-------------|
| `severity` | string | No | `INFO`, `WARNING`, `CRITICAL` | Filter by severity level |
| `acknowledged` | string | No | `true`, `false` | Filter by acknowledgment status |
| `type` | string | No | `DEVICE_OFFLINE`, `HIGH_POWER`, `INVALID_DATA`, `LOW_HEALTH` | Filter by alert type |

---

#### Sample Request — All Alerts (Unfiltered)

**Request:**
```http
GET /api/alerts/
```

**Response — 200 OK:**
```json
[
    {
        "id": 5,
        "device_code": "PARK-B2-S006",
        "zone_name": "Basement-2",
        "alert_type": "DEVICE_OFFLINE",
        "severity": "CRITICAL",
        "message": "Device PARK-B2-S006 was offline (resolved)",
        "is_acknowledged": true,
        "acknowledged_at": "2026-02-18T01:30:00Z",
        "created_at": "2026-02-18T03:30:00Z"
    },
    {
        "id": 4,
        "device_code": "PARK-B2-S001",
        "zone_name": "Basement-2",
        "alert_type": "LOW_HEALTH",
        "severity": "INFO",
        "message": "Device PARK-B2-S001 health score dropped to 25",
        "is_acknowledged": false,
        "acknowledged_at": null,
        "created_at": "2026-02-18T03:30:00Z"
    },
    {
        "id": 3,
        "device_code": "PARK-B1-S009",
        "zone_name": "Basement-1",
        "alert_type": "INVALID_DATA",
        "severity": "WARNING",
        "message": "Device PARK-B1-S009 reported voltage of 50V (below 100V threshold)",
        "is_acknowledged": false,
        "acknowledged_at": null,
        "created_at": "2026-02-18T03:30:00Z"
    },
    {
        "id": 2,
        "device_code": "PARK-B1-S006",
        "zone_name": "Basement-1",
        "alert_type": "HIGH_POWER",
        "severity": "WARNING",
        "message": "Device PARK-B1-S006 reported power consumption of 1650W",
        "is_acknowledged": false,
        "acknowledged_at": null,
        "created_at": "2026-02-18T03:30:00Z"
    },
    {
        "id": 1,
        "device_code": "PARK-B1-S003",
        "zone_name": "Basement-1",
        "alert_type": "DEVICE_OFFLINE",
        "severity": "CRITICAL",
        "message": "Device PARK-B1-S003 has not sent data for over 10 minutes",
        "is_acknowledged": false,
        "acknowledged_at": null,
        "created_at": "2026-02-18T03:30:00Z"
    }
]
```

---

#### Sample Request — Only Unacknowledged Alerts

**Request:**
```http
GET /api/alerts/?acknowledged=false
```

Returns only alerts where `is_acknowledged` is `false`.

---

#### Sample Request — Filter by Severity

**Request:**
```http
GET /api/alerts/?severity=CRITICAL
```

Returns only `CRITICAL` severity alerts.

---

#### Sample Request — Filter by Type

**Request:**
```http
GET /api/alerts/?type=HIGH_POWER
```

Returns only `HIGH_POWER` alerts.

---

#### Sample Request — Combined Filters

**Request:**
```http
GET /api/alerts/?severity=WARNING&acknowledged=false&type=INVALID_DATA
```

Returns only unacknowledged WARNING-severity INVALID_DATA alerts.

---

**Response Fields:**

| Field | Type | Description |
|-------|------|-------------|
| `id` | integer | Unique alert ID |
| `device_code` | string/null | Device code that triggered the alert (null if device was deleted) |
| `zone_name` | string/null | Zone name associated with the alert (null if zone was deleted) |
| `alert_type` | string | One of: `DEVICE_OFFLINE`, `HIGH_POWER`, `INVALID_DATA`, `LOW_HEALTH` |
| `severity` | string | One of: `INFO`, `WARNING`, `CRITICAL` |
| `message` | string | Human-readable description of the alert |
| `is_acknowledged` | boolean | `true` if alert has been acknowledged, `false` otherwise |
| `acknowledged_at` | string/null | ISO 8601 timestamp when acknowledged, or `null` |
| `created_at` | string | ISO 8601 timestamp when the alert was created |

---

### 7. Acknowledge Alert

Marks a single alert as acknowledged. Sets `is_acknowledged=True` and records the current timestamp in `acknowledged_at`.

**Endpoint:** `PATCH /api/alerts/{id}/acknowledge/`

**Path Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | integer | Yes | The alert ID to acknowledge |

---

#### Sample Request — Successfully Acknowledge

**Request:**
```http
PATCH /api/alerts/1/acknowledge/
```

**Response — 200 OK:**
```json
{
    "status": "success",
    "message": "Alert acknowledged.",
    "alert_id": 1,
    "acknowledged_at": "2026-02-18T05:45:00Z"
}
```

---

#### Sample Request — Already Acknowledged

**Request:**
```http
PATCH /api/alerts/1/acknowledge/
```

**Response — 200 OK:**
```json
{
    "status": "info",
    "message": "Alert already acknowledged."
}
```

---

#### Error Response — Alert Not Found

**Request:**
```http
PATCH /api/alerts/9999/acknowledge/
```

**Response — 404 Not Found:**
```json
{
    "status": "error",
    "message": "Alert not found."
}
```

---

## Resource APIs

### 8. List Facilities

Returns all parking facilities in the system.

**Endpoint:** `GET /api/facilities/`

**Query Parameters:** None

---

#### Sample Request

**Request:**
```http
GET /api/facilities/
```

**Response — 200 OK:**
```json
[
    {
        "id": 1,
        "name": "City Center Mall Parking",
        "address": "123 Main Street, Downtown",
        "is_active": true,
        "zone_count": 4,
        "created_at": "2026-02-18T03:30:00Z"
    }
]
```

**Response Fields:**

| Field | Type | Description |
|-------|------|-------------|
| `id` | integer | Facility primary key |
| `name` | string | Facility name |
| `address` | string | Physical address |
| `is_active` | boolean | Whether the facility is active |
| `zone_count` | integer | Number of zones in this facility (computed) |
| `created_at` | string | ISO 8601 creation timestamp |

---

### 9. List Zones

Returns parking zones with optional facility filter. Includes real-time occupied count based on the latest ParkingLog per device.

**Endpoint:** `GET /api/zones/`

**Query Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `facility` | integer | No | Filter zones by facility ID |

---

#### Sample Request — All Zones

**Request:**
```http
GET /api/zones/
```

**Response — 200 OK:**
```json
[
    {
        "id": 1,
        "name": "Basement-1",
        "facility_name": "City Center Mall Parking",
        "zone_type": "BASEMENT",
        "total_slots": 20,
        "occupied_count": 11,
        "is_active": true,
        "created_at": "2026-02-18T03:30:00Z"
    },
    {
        "id": 2,
        "name": "Basement-2",
        "facility_name": "City Center Mall Parking",
        "zone_type": "BASEMENT",
        "total_slots": 15,
        "occupied_count": 8,
        "is_active": true,
        "created_at": "2026-02-18T03:30:00Z"
    },
    {
        "id": 3,
        "name": "Outdoor",
        "facility_name": "City Center Mall Parking",
        "zone_type": "OUTDOOR",
        "total_slots": 10,
        "occupied_count": 5,
        "is_active": true,
        "created_at": "2026-02-18T03:30:00Z"
    },
    {
        "id": 4,
        "name": "VIP",
        "facility_name": "City Center Mall Parking",
        "zone_type": "VIP",
        "total_slots": 5,
        "occupied_count": 3,
        "is_active": true,
        "created_at": "2026-02-18T03:30:00Z"
    }
]
```

---

#### Sample Request — Filter by Facility

**Request:**
```http
GET /api/zones/?facility=1
```

Returns only zones belonging to facility ID 1.

---

**Response Fields:**

| Field | Type | Description |
|-------|------|-------------|
| `id` | integer | Zone primary key |
| `name` | string | Zone name (e.g., "Basement-1", "VIP") |
| `facility_name` | string | Parent facility name |
| `zone_type` | string | One of: `BASEMENT`, `OUTDOOR`, `VIP`, `ROOFTOP` |
| `total_slots` | integer | Total parking slots configured for this zone |
| `occupied_count` | integer | Real-time count of occupied slots (based on latest ParkingLog per device) |
| `is_active` | boolean | Whether the zone is active |
| `created_at` | string | ISO 8601 creation timestamp |

---

### 10. List Devices

Returns all IoT parking sensor devices with their current status, health score, and location information. Supports filtering by zone, active status, and text search.

**Endpoint:** `GET /api/devices/`

**Query Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `zone` | integer | No | Filter by zone ID |
| `active` | string | No | Filter by active status: `true` or `false` |
| `search` | string | No | Case-insensitive search on `device_code` (uses `icontains`) |

---

#### Sample Request — All Devices

**Request:**
```http
GET /api/devices/
```

**Response — 200 OK (truncated — returns all 50 devices):**
```json
[
    {
        "id": 1,
        "device_code": "PARK-B1-S001",
        "slot_number": "S001",
        "zone_name": "Basement-1",
        "zone_id": 1,
        "facility_name": "City Center Mall Parking",
        "is_active": true,
        "health_score": 92,
        "last_seen_at": "2026-02-18T03:30:00Z",
        "installed_at": "2026-02-18T03:30:00Z"
    },
    {
        "id": 2,
        "device_code": "PARK-B1-S002",
        "slot_number": "S002",
        "zone_name": "Basement-1",
        "zone_id": 1,
        "facility_name": "City Center Mall Parking",
        "is_active": true,
        "health_score": 95,
        "last_seen_at": "2026-02-18T03:30:00Z",
        "installed_at": "2026-02-18T03:30:00Z"
    }
]
```

---

#### Sample Request — Filter by Zone

**Request:**
```http
GET /api/devices/?zone=4
```

Returns only devices in zone 4 (VIP), which has 5 devices.

---

#### Sample Request — Search by Device Code

**Request:**
```http
GET /api/devices/?search=PARK-VIP
```

**Response — 200 OK:**
```json
[
    {
        "id": 46,
        "device_code": "PARK-VIP-S001",
        "slot_number": "S001",
        "zone_name": "VIP",
        "zone_id": 4,
        "facility_name": "City Center Mall Parking",
        "is_active": true,
        "health_score": 100,
        "last_seen_at": "2026-02-18T03:30:00Z",
        "installed_at": "2026-02-18T03:30:00Z"
    },
    {
        "id": 47,
        "device_code": "PARK-VIP-S002",
        "slot_number": "S002",
        "zone_name": "VIP",
        "zone_id": 4,
        "facility_name": "City Center Mall Parking",
        "is_active": true,
        "health_score": 100,
        "last_seen_at": "2026-02-18T03:30:00Z",
        "installed_at": "2026-02-18T03:30:00Z"
    }
]
```

---

#### Sample Request — Combined Filters

**Request:**
```http
GET /api/devices/?zone=1&active=true&search=S001
```

Returns active devices in zone 1 with "S001" in the device code.

---

**Response Fields:**

| Field | Type | Description |
|-------|------|-------------|
| `id` | integer | Device primary key |
| `device_code` | string | Unique device identifier (e.g., `PARK-B1-S001`) |
| `slot_number` | string | Parking slot number (e.g., `S001`) |
| `zone_name` | string | Zone name this device belongs to |
| `zone_id` | integer | Zone primary key |
| `facility_name` | string | Facility name this device belongs to |
| `is_active` | boolean | Whether the device is active |
| `health_score` | integer | Device health score (0–100) |
| `last_seen_at` | string/null | Last telemetry timestamp, or null if never seen |
| `installed_at` | string | When the device was installed |

**Health Score Interpretation:**

| Score Range | Status | Visual Indicator |
|-------------|--------|-----------------|
| 80–100 | Healthy | Green |
| 50–79 | Degraded | Orange |
| 0–49 | Critical | Red |

---

### 11. List Parking Logs

Returns parking occupancy event history. Results are ordered by timestamp (newest first) and limited to 200 records.

**Endpoint:** `GET /api/parking-logs/`

**Query Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `zone` | integer | No | Filter logs by zone ID |
| `date` | string | No | Filter by date (`YYYY-MM-DD`) |

---

#### Sample Request — All Logs

**Request:**
```http
GET /api/parking-logs/
```

**Response — 200 OK (truncated):**
```json
[
    {
        "id": 412,
        "device_code": "PARK-B1-S005",
        "zone_name": "Basement-1",
        "is_occupied": true,
        "timestamp": "2026-02-18T03:28:15Z",
        "received_at": "2026-02-18T03:30:00Z"
    },
    {
        "id": 411,
        "device_code": "PARK-B2-S003",
        "zone_name": "Basement-2",
        "is_occupied": false,
        "timestamp": "2026-02-18T03:15:42Z",
        "received_at": "2026-02-18T03:30:00Z"
    },
    {
        "id": 410,
        "device_code": "PARK-VIP-S002",
        "zone_name": "VIP",
        "is_occupied": true,
        "timestamp": "2026-02-18T02:50:30Z",
        "received_at": "2026-02-18T03:30:00Z"
    }
]
```

---

#### Sample Request — Filter by Zone and Date

**Request:**
```http
GET /api/parking-logs/?zone=1&date=2026-02-18
```

Returns only logs for zone 1 (Basement-1) on February 18, 2026.

---

**Response Fields:**

| Field | Type | Description |
|-------|------|-------------|
| `id` | integer | Log entry primary key |
| `device_code` | string | Device that recorded this event |
| `zone_name` | string | Zone the device belongs to |
| `is_occupied` | boolean | `true` = slot became occupied, `false` = slot was freed |
| `timestamp` | string | When the occupancy event occurred |
| `received_at` | string | When the server received/stored the event |

---

### 12. List Parking Targets

Returns daily parking usage targets per zone for efficiency tracking. Each target includes a computed `actual_usage` (counted at query time) and `efficiency` percentage.

**Endpoint:** `GET /api/targets/`

**Query Parameters:**

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `date` | string | No | Today | Filter by date (`YYYY-MM-DD`) |

---

#### Sample Request — Today's Targets

**Request:**
```http
GET /api/targets/
```

**Response — 200 OK:**
```json
[
    {
        "id": 3,
        "zone_name": "Basement-1",
        "date": "2026-02-18",
        "target_occupancy_count": 16,
        "actual_usage": 162,
        "efficiency": 1012.5
    },
    {
        "id": 4,
        "zone_name": "Basement-2",
        "date": "2026-02-18",
        "target_occupancy_count": 12,
        "actual_usage": 115,
        "efficiency": 958.3
    },
    {
        "id": 5,
        "zone_name": "Outdoor",
        "date": "2026-02-18",
        "target_occupancy_count": 8,
        "actual_usage": 72,
        "efficiency": 900.0
    },
    {
        "id": 6,
        "zone_name": "VIP",
        "date": "2026-02-18",
        "target_occupancy_count": 4,
        "actual_usage": 36,
        "efficiency": 900.0
    }
]
```

> **Note:** The seed data sets `target_occupancy_count = total_slots × 0.8`. With random parking logs from the seeder, `actual_usage` can exceed the target, resulting in efficiency > 100%.

---

#### Sample Request — Specific Date

**Request:**
```http
GET /api/targets/?date=2026-02-17
```

Returns yesterday's targets.

---

#### Error Response — Invalid Date

**Request:**
```http
GET /api/targets/?date=bad-date
```

**Response — 400 Bad Request:**
```json
{
    "error": "Invalid date format. Use YYYY-MM-DD."
}
```

---

**Response Fields:**

| Field | Type | Description |
|-------|------|-------------|
| `id` | integer | Target record primary key |
| `zone_name` | string | Name of the zone |
| `date` | string | Target date (`YYYY-MM-DD`) |
| `target_occupancy_count` | integer | Expected number of occupied slots for the day |
| `actual_usage` | integer | Actual count of `is_occupied=True` ParkingLog events for this zone on this date (computed at query time) |
| `efficiency` | float | `(actual_usage / target_occupancy_count) × 100`, rounded to 1 decimal |

---

## Data Models

### Entity Relationship Diagram

```
┌─────────────────┐       ┌──────────────┐       ┌──────────────┐       ┌──────────┐
│ ParkingFacility  │──1:N──│  ParkingZone  │──1:N──│  ParkingSlot  │──1:1──│  Device   │
│                  │       │              │       │              │       │          │
│ id               │       │ id           │       │ id           │       │ id       │
│ name             │       │ facility_id  │       │ zone_id      │       │ slot_id  │
│ address          │       │ name         │       │ slot_number  │       │ device_  │
│ is_active        │       │ zone_type    │       │ is_active    │       │   code   │
│ created_at       │       │ total_slots  │       └──────────────┘       │ is_active│
│ updated_at       │       │ is_active    │                              │ health_  │
└─────────────────┘       │ created_at   │                              │   score  │
                           └──────┬───────┘                              │ last_    │
                                  │                                      │   seen   │
                           ┌──────┴───────┐                        ┌─────┴──────────┤
                           │ParkingTarget │                        │                │
                           │              │                   ┌────┴─────┐   ┌──────┴──────┐
                           │ id           │                   │Telemetry │   │ ParkingLog  │
                           │ zone_id      │                   │  Data    │   │             │
                           │ date         │                   │          │   │ id          │
                           │ target_      │                   │ id       │   │ device_id   │
                           │  occupancy   │                   │ device_id│   │ is_occupied │
                           │  _count      │                   │ voltage  │   │ timestamp   │
                           │ target_      │                   │ current  │   │ received_at │
                           │  usage_hours │                   │ power_   │   └─────────────┘
                           │ created_at   │                   │  factor  │
                           └──────────────┘                   │ power_   │
                                                              │  consump.│
                                                              │ timestamp│
                           ┌──────────────┐                   │ received │
                           │    Alert     │                   │  _at     │
                           │              │                   └──────────┘
                           │ id           │
                           │ device_id (FK, nullable)
                           │ zone_id (FK, nullable)
                           │ alert_type   │
                           │ severity     │
                           │ message      │
                           │ is_acknowledged
                           │ acknowledged_at
                           │ created_at   │
                           └──────────────┘
```

### Model Schemas

#### ParkingFacility
| Field | Type | Constraints |
|-------|------|-------------|
| `id` | integer | Primary Key, Auto-increment |
| `name` | string(200) | Required |
| `address` | text | Optional (can be blank) |
| `is_active` | boolean | Default: `true` |
| `created_at` | datetime | Auto-set on creation |
| `updated_at` | datetime | Auto-updated on save |

#### ParkingZone
| Field | Type | Constraints |
|-------|------|-------------|
| `id` | integer | Primary Key, Auto-increment |
| `facility_id` | integer | Foreign Key → `ParkingFacility` |
| `name` | string(100) | Required |
| `zone_type` | enum | One of: `BASEMENT`, `OUTDOOR`, `VIP`, `ROOFTOP` |
| `total_slots` | integer | Default: `0` |
| `is_active` | boolean | Default: `true` |
| `created_at` | datetime | Auto-set on creation |

**Unique constraint:** `(facility_id, name)` — no two zones in the same facility can have the same name.

#### ParkingSlot
| Field | Type | Constraints |
|-------|------|-------------|
| `id` | integer | Primary Key, Auto-increment |
| `zone_id` | integer | Foreign Key → `ParkingZone` |
| `slot_number` | string(20) | Required (e.g., `S001`) |
| `is_active` | boolean | Default: `true` |

**Unique constraint:** `(zone_id, slot_number)`

#### Device
| Field | Type | Constraints |
|-------|------|-------------|
| `id` | integer | Primary Key, Auto-increment |
| `slot_id` | integer | Foreign Key → `ParkingSlot`, **Unique** (OneToOne) |
| `device_code` | string(50) | **Unique**, Indexed (e.g., `PARK-B1-S001`) |
| `is_active` | boolean | Default: `true` |
| `last_seen_at` | datetime | Nullable — updated on each telemetry ingestion |
| `health_score` | integer | 0–100, Default: `100` |
| `installed_at` | datetime | Auto-set on creation |

#### TelemetryData
| Field | Type | Constraints |
|-------|------|-------------|
| `id` | integer | Primary Key, Auto-increment |
| `device_id` | integer | Foreign Key → `Device` |
| `voltage` | float | Required |
| `current` | float | Required |
| `power_factor` | float | Required |
| `power_consumption` | float | Computed on save: `voltage × current × power_factor` |
| `timestamp` | datetime | Indexed |
| `received_at` | datetime | Auto-set on creation |

**Unique constraint:** `(device_id, timestamp)`

#### ParkingLog
| Field | Type | Constraints |
|-------|------|-------------|
| `id` | integer | Primary Key, Auto-increment |
| `device_id` | integer | Foreign Key → `Device` |
| `is_occupied` | boolean | Required |
| `timestamp` | datetime | Indexed |
| `received_at` | datetime | Auto-set on creation |

**Default ordering:** `-timestamp` (newest first)

#### Alert
| Field | Type | Constraints |
|-------|------|-------------|
| `id` | integer | Primary Key, Auto-increment |
| `device_id` | integer | Foreign Key → `Device`, **Nullable** |
| `zone_id` | integer | Foreign Key → `ParkingZone`, **Nullable** |
| `alert_type` | enum | One of: `DEVICE_OFFLINE`, `HIGH_POWER`, `INVALID_DATA`, `LOW_HEALTH` |
| `severity` | enum | One of: `INFO`, `WARNING`, `CRITICAL` |
| `message` | text | Required — human-readable description |
| `is_acknowledged` | boolean | Default: `false` |
| `acknowledged_at` | datetime | Nullable — set when acknowledged |
| `created_at` | datetime | Auto-set on creation |

**Default ordering:** `-created_at` (newest first)

#### ParkingTarget
| Field | Type | Constraints |
|-------|------|-------------|
| `id` | integer | Primary Key, Auto-increment |
| `zone_id` | integer | Foreign Key → `ParkingZone` |
| `date` | date | Indexed |
| `target_occupancy_count` | integer | Required — expected occupied slots for the day |
| `target_usage_hours` | integer | Default: `0` |
| `created_at` | datetime | Auto-set on creation |

**Unique constraint:** `(zone_id, date)` — one target per zone per day.

---

## Error Handling

### Standard Error Response Format

All validation errors from POST/PATCH endpoints follow this structure:

```json
{
    "status": "error",
    "errors": {
        "field_name": ["Error message 1", "Error message 2"],
        "non_field_errors": ["General validation error"]
    }
}
```

### HTTP Status Codes Used

| Code | Method | Meaning |
|------|--------|---------|
| `200 OK` | GET, PATCH | Successful retrieval or update |
| `201 Created` | POST | Resource successfully created |
| `400 Bad Request` | POST | Validation error(s) occurred |
| `404 Not Found` | PATCH | Resource not found (e.g., alert ID doesn't exist) |
| `500 Internal Server Error` | Any | Unexpected server error |

### Complete Validation Error Reference

| Error Message | Endpoint | Cause |
|---------------|----------|-------|
| `Device with code 'X' does not exist or is inactive.` | POST telemetry, parking-log | Device code not found or `is_active=False` |
| `Timestamp cannot be in the future.` | POST telemetry, parking-log | Timestamp is more than 5 minutes ahead of server UTC time |
| `Duplicate telemetry: a record for this device already exists within a 1-minute window.` | POST telemetry | A telemetry record exists for same device within ±1 minute |
| `Expected a list of telemetry records.` | POST telemetry/bulk | Request body is not a JSON array |
| `The list cannot be empty.` | POST telemetry/bulk | Request body is an empty array `[]` |
| `This field is required.` | POST telemetry, parking-log | A required field is missing |
| `Invalid date format. Use YYYY-MM-DD.` | GET dashboard/summary, hourly, targets | Date parameter doesn't match `YYYY-MM-DD` format |
| `Alert not found.` | PATCH alerts/{id}/acknowledge | Alert ID doesn't exist |

---

## Alert Detection Logic

Alerts are automatically generated during telemetry ingestion. The detection pipeline works as follows:

```
Telemetry Ingested
       │
       ├──► save TelemetryData record
       ├──► update device.last_seen_at
       ├──► run_all_detections(telemetry)
       │       ├──► detect_high_power()    → creates HIGH_POWER alert if power > 1500W
       │       ├──► detect_invalid_data()  → creates INVALID_DATA alert if voltage outside 100–300V
       │       └──► detect_low_health()    → creates LOW_HEALTH alert if health_score < 30
       └──► compute_device_health(device)  → recalculates 0–100 health score
```

### Alert Types and Severities

| # | Alert Type | Severity | Trigger Condition | Detection Method |
|---|-----------|----------|-------------------|-----------------|
| 1 | `DEVICE_OFFLINE` | **CRITICAL** | `last_seen_at` is older than 2 minutes | `detect_offline_devices()` — must be called externally (not inline) |
| 2 | `HIGH_POWER` | **WARNING** | `power_consumption` > 1,500 Watts | Inline after each telemetry save |
| 3 | `INVALID_DATA` | **WARNING** | `voltage` < 100V or > 300V | Inline after each telemetry save |
| 4 | `LOW_HEALTH` | **INFO** | `health_score` < 30 | Inline after health score recomputation |

### Duplicate Alert Prevention

Before creating any alert, the system checks:
- Does an **unacknowledged** alert of the same `alert_type` already exist for the same `device`?
- If yes → **no new alert is created** (prevents alert storms during sustained faults)
- If no → new alert is created

This means acknowledging an alert allows the system to re-trigger if the condition persists.

### Alert Message Format Examples

| Type | Example Message |
|------|----------------|
| `DEVICE_OFFLINE` | `"Device PARK-B1-S003 has not sent data for over 2 minutes."` |
| `HIGH_POWER` | `"Device PARK-B1-S006 reported power consumption of 1650.0W (threshold: 1500W)."` |
| `INVALID_DATA` | `"Device PARK-B1-S009 reported voltage of 50V (valid range: 100–300V)."` |
| `LOW_HEALTH` | `"Device PARK-B2-S001 health score dropped to 25 (threshold: 30)."` |

---

## Health Score Calculation

Device health score (0–100) is recomputed after every telemetry ingestion using 4 weighted factors:

### Scoring Formula

```
health_score = (recency × 0.40) + (voltage × 0.20) + (power × 0.20) + (alerts × 0.20)
```

### Factor Details

| Factor | Weight | Score = 100 | Score = 60 | Score = 50 | Score = 20 | Score = 10 | Score = 0 |
|--------|--------|-------------|------------|------------|------------|------------|-----------|
| **Recency** | 40% | `last_seen_at` ≤ 2 min ago | — | — | — | — | > 60 min ago (linear decay 2–60 min) |
| **Voltage** | 20% | Avg 200–250V | Avg 150–200V or 250–300V | — | Outside both ranges | — | — |
| **Power** | 20% | Avg ≤ 1,500W | — | Avg 1,500–2,250W | — | Avg > 2,250W | — |
| **Alerts** | 20% | 0 open alerts | ≤ 2 open alerts | — | > 2 open alerts | — | — |

### Notes
- **Voltage and Power** scores use the **1-hour rolling average** from recent TelemetryData records
- **Recency** uses linear decay: score decreases linearly from 100 to 0 between 2 and 60 minutes since last seen
- **Open alerts** = unacknowledged alerts for this specific device
- Final score is clamped to the range [0, 100]

---

## Postman Collection Quick Reference

### Pre-configured Requests

Use these ready-made requests in Postman. Replace timestamps with current/recent times.

| # | Method | Name | URL |
|---|--------|------|-----|
| 1 | POST | Single Telemetry | `http://localhost:8000/api/telemetry/` |
| 2 | POST | Bulk Telemetry | `http://localhost:8000/api/telemetry/bulk/` |
| 3 | POST | Parking Log | `http://localhost:8000/api/parking-log/` |
| 4 | GET | Dashboard Summary | `http://localhost:8000/api/dashboard/summary/?date=2026-02-18` |
| 5 | GET | Dashboard Hourly | `http://localhost:8000/api/dashboard/hourly/?date=2026-02-18&zone=1` |
| 6 | GET | List Alerts | `http://localhost:8000/api/alerts/?acknowledged=false` |
| 7 | PATCH | Acknowledge Alert | `http://localhost:8000/api/alerts/1/acknowledge/` |
| 8 | GET | List Facilities | `http://localhost:8000/api/facilities/` |
| 9 | GET | List Zones | `http://localhost:8000/api/zones/?facility=1` |
| 10 | GET | List Devices | `http://localhost:8000/api/devices/?zone=1&active=true` |
| 11 | GET | List Parking Logs | `http://localhost:8000/api/parking-logs/?zone=1&date=2026-02-18` |
| 12 | GET | List Targets | `http://localhost:8000/api/targets/?date=2026-02-18` |

### Available Seed Device Codes

```
Zone: Basement-1 (zone_id=1) → PARK-B1-S001 through PARK-B1-S020
Zone: Basement-2 (zone_id=2) → PARK-B2-S001 through PARK-B2-S015
Zone: Outdoor    (zone_id=3) → PARK-OUT-S001 through PARK-OUT-S010
Zone: VIP        (zone_id=4) → PARK-VIP-S001 through PARK-VIP-S005
```

---

## cURL Examples

```bash
# ─── Setup ─────────────────────────────────────────────
# Seed the database (run from /backend directory)
python manage.py seed_data

# ─── 1. Single Telemetry Ingestion ────────────────────
curl -X POST http://localhost:8000/api/telemetry/ \
  -H "Content-Type: application/json" \
  -d '{
    "device_code": "PARK-B1-S001",
    "voltage": 225.3,
    "current": 4.5,
    "power_factor": 0.92,
    "timestamp": "2026-02-18T03:30:00Z"
  }'

# ─── 2. Bulk Telemetry Ingestion ──────────────────────
curl -X POST http://localhost:8000/api/telemetry/bulk/ \
  -H "Content-Type: application/json" \
  -d '[
    {
      "device_code": "PARK-B1-S001",
      "voltage": 222.0,
      "current": 4.2,
      "power_factor": 0.93,
      "timestamp": "2026-02-18T02:00:00Z"
    },
    {
      "device_code": "PARK-B2-S001",
      "voltage": 219.5,
      "current": 3.8,
      "power_factor": 0.91,
      "timestamp": "2026-02-18T02:00:00Z"
    }
  ]'

# ─── 3. Parking Log (slot occupied) ──────────────────
curl -X POST http://localhost:8000/api/parking-log/ \
  -H "Content-Type: application/json" \
  -d '{
    "device_code": "PARK-B1-S001",
    "is_occupied": true,
    "timestamp": "2026-02-18T03:15:00Z"
  }'

# ─── 4. Parking Log (slot freed) ─────────────────────
curl -X POST http://localhost:8000/api/parking-log/ \
  -H "Content-Type: application/json" \
  -d '{
    "device_code": "PARK-B1-S001",
    "is_occupied": false,
    "timestamp": "2026-02-18T04:30:00Z"
  }'

# ─── 5. Dashboard Summary ────────────────────────────
curl "http://localhost:8000/api/dashboard/summary/"
curl "http://localhost:8000/api/dashboard/summary/?date=2026-02-18"
curl "http://localhost:8000/api/dashboard/summary/?date=2026-02-18&facility=1"

# ─── 6. Dashboard Hourly ─────────────────────────────
curl "http://localhost:8000/api/dashboard/hourly/"
curl "http://localhost:8000/api/dashboard/hourly/?date=2026-02-18&zone=1"

# ─── 7. List Alerts ──────────────────────────────────
curl "http://localhost:8000/api/alerts/"
curl "http://localhost:8000/api/alerts/?acknowledged=false"
curl "http://localhost:8000/api/alerts/?severity=CRITICAL"
curl "http://localhost:8000/api/alerts/?type=HIGH_POWER"
curl "http://localhost:8000/api/alerts/?severity=WARNING&acknowledged=false"

# ─── 8. Acknowledge Alert ────────────────────────────
curl -X PATCH http://localhost:8000/api/alerts/1/acknowledge/

# ─── 9. List Facilities ──────────────────────────────
curl "http://localhost:8000/api/facilities/"

# ─── 10. List Zones ──────────────────────────────────
curl "http://localhost:8000/api/zones/"
curl "http://localhost:8000/api/zones/?facility=1"

# ─── 11. List Devices ────────────────────────────────
curl "http://localhost:8000/api/devices/"
curl "http://localhost:8000/api/devices/?zone=1"
curl "http://localhost:8000/api/devices/?active=true"
curl "http://localhost:8000/api/devices/?search=PARK-VIP"
curl "http://localhost:8000/api/devices/?zone=1&active=true&search=S001"

# ─── 12. List Parking Logs ───────────────────────────
curl "http://localhost:8000/api/parking-logs/"
curl "http://localhost:8000/api/parking-logs/?zone=1"
curl "http://localhost:8000/api/parking-logs/?date=2026-02-18"
curl "http://localhost:8000/api/parking-logs/?zone=1&date=2026-02-18"

# ─── 13. List Targets ────────────────────────────────
curl "http://localhost:8000/api/targets/"
curl "http://localhost:8000/api/targets/?date=2026-02-18"
curl "http://localhost:8000/api/targets/?date=2026-02-17"
```

---

## API Summary Table

| # | Method | Endpoint | Description |
|---|--------|----------|-------------|
| 1 | `POST` | `/api/telemetry/` | Ingest single telemetry reading |
| 2 | `POST` | `/api/telemetry/bulk/` | Ingest multiple telemetry readings |
| 3 | `POST` | `/api/parking-log/` | Record parking occupancy event |
| 4 | `GET` | `/api/dashboard/summary/` | Aggregated dashboard statistics |
| 5 | `GET` | `/api/dashboard/hourly/` | 24-hour usage breakdown |
| 6 | `GET` | `/api/alerts/` | List alerts with filters |
| 7 | `PATCH` | `/api/alerts/{id}/acknowledge/` | Acknowledge an alert |
| 8 | `GET` | `/api/facilities/` | List all facilities |
| 9 | `GET` | `/api/zones/` | List zones (optional facility filter) |
| 10 | `GET` | `/api/devices/` | List devices (zone/active/search filters) |
| 11 | `GET` | `/api/parking-logs/` | List parking log history |
| 12 | `GET` | `/api/targets/` | List daily parking targets |

---

## Changelog

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | 2026-02-18 | Initial API documentation |
| 1.1.0 | 2026-02-18 | Corrected response shapes, parameter names, hourly endpoint fields, alert severities, health score thresholds |
| 2.0.0 | 2026-02-18 | Complete rewrite: added realistic seed device codes (`PARK-*`), full request/response samples for all 12 endpoints including all error scenarios, detailed field descriptions, health score algorithm, alert detection pipeline, Postman quick reference, comprehensive cURL examples |
