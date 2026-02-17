# Smart Car Parking Monitoring & Alert System — API Documentation

## Overview

This document provides comprehensive API documentation for the Smart Car Parking Monitoring & Alert System. All request/response examples match the actual backend implementation.

**Base URL:** `http://localhost:8000`

**Content-Type:** `application/json`

---

## Table of Contents

1. [Authentication](#authentication)
2. [Data Ingestion APIs](#data-ingestion-apis)
   - [Single Telemetry Ingestion](#1-single-telemetry-ingestion)
   - [Bulk Telemetry Ingestion](#2-bulk-telemetry-ingestion)
   - [Parking Log Event](#3-parking-log-event)
3. [Dashboard APIs](#dashboard-apis)
   - [Dashboard Summary](#4-dashboard-summary)
   - [Hourly Usage Data](#5-hourly-usage-data)
4. [Alert Management APIs](#alert-management-apis)
   - [List Alerts](#6-list-alerts)
   - [Acknowledge Alert](#7-acknowledge-alert)
5. [Resource APIs](#resource-apis)
   - [List Facilities](#8-list-facilities)
   - [List Zones](#9-list-zones)
   - [List Devices](#10-list-devices)
   - [List Parking Logs](#11-list-parking-logs)
   - [List Parking Targets](#12-list-parking-targets)
6. [Data Models](#data-models)
7. [Error Handling](#error-handling)
8. [Alert Detection Logic](#alert-detection-logic)

---

## Authentication

Currently, the API does not require authentication for development purposes. In production, implement token-based authentication (JWT or DRF Token Auth).

---

## Data Ingestion APIs

### 1. Single Telemetry Ingestion

Ingests a single telemetry record from an IoT device. Triggers inline alert detection and health score recomputation.

**Endpoint:** `POST /api/telemetry/`

**Request Body:**

```json
{
    "device_code": "DEV-B1-001",
    "voltage": 220.5,
    "current": 1.2,
    "power_factor": 0.95,
    "timestamp": "2026-02-18T10:30:00Z"
}
```

**Request Parameters:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `device_code` | string | Yes | Unique device identifier (max 50 chars) |
| `voltage` | float | Yes | Voltage reading in Volts |
| `current` | float | Yes | Current reading in Amperes |
| `power_factor` | float | Yes | Power factor (0.0 to 1.0) |
| `timestamp` | datetime | Yes | ISO 8601 timestamp of the reading |

**Validations:**
- `device_code` must match an existing, active device
- `timestamp` cannot be in the future
- No duplicate within a **1-minute window** for the same device (rejects if a record exists within ±1 minute)

**Success Response (201 Created):**

```json
{
    "status": "success",
    "message": "Telemetry data recorded.",
    "device_code": "DEV-B1-001",
    "power_consumption": 251.37,
    "timestamp": "2026-02-18T10:30:00Z",
    "alerts_triggered": [],
    "health_score": 95
}
```

| Field | Type | Description |
|-------|------|-------------|
| `status` | string | `"success"` |
| `message` | string | Confirmation message |
| `device_code` | string | Device that received the data |
| `power_consumption` | float | Computed: `voltage × current × power_factor` |
| `timestamp` | datetime | The ingested timestamp |
| `alerts_triggered` | array | List of alert types triggered (e.g., `["HIGH_POWER"]`) |
| `health_score` | integer | Updated health score (0–100) |

**Error Responses (400 Bad Request):**

```json
{
    "status": "error",
    "errors": {
        "device_code": ["Device with code 'INVALID' does not exist or is inactive."]
    }
}
```

```json
{
    "status": "error",
    "errors": {
        "timestamp": ["Timestamp cannot be in the future."]
    }
}
```

```json
{
    "status": "error",
    "errors": {
        "non_field_errors": ["Duplicate telemetry: a record for this device already exists within a 1-minute window."]
    }
}
```

---

### 2. Bulk Telemetry Ingestion

Ingests multiple telemetry records in a single request. Validates each record independently — partial success is supported.

**Endpoint:** `POST /api/telemetry/bulk/`

**Request Body:**

```json
[
    {
        "device_code": "DEV-B1-001",
        "voltage": 220.5,
        "current": 1.2,
        "power_factor": 0.95,
        "timestamp": "2026-02-18T10:30:00Z"
    },
    {
        "device_code": "DEV-B1-002",
        "voltage": 218.0,
        "current": 1.5,
        "power_factor": 0.92,
        "timestamp": "2026-02-18T10:30:00Z"
    },
    {
        "device_code": "INVALID-DEVICE",
        "voltage": 220.0,
        "current": 1.0,
        "power_factor": 0.90,
        "timestamp": "2026-02-18T10:30:00Z"
    }
]
```

**Success Response (201 Created):**

```json
{
    "status": "success",
    "created_count": 2,
    "failed_count": 1,
    "created": [
        {
            "device_code": "DEV-B1-001",
            "timestamp": "2026-02-18T10:30:00Z",
            "power_consumption": 251.37
        },
        {
            "device_code": "DEV-B1-002",
            "timestamp": "2026-02-18T10:30:00Z",
            "power_consumption": 300.84
        }
    ],
    "errors": [
        {
            "index": 2,
            "data": {
                "device_code": "INVALID-DEVICE",
                "voltage": 220.0,
                "current": 1.0,
                "power_factor": 0.90,
                "timestamp": "2026-02-18T10:30:00Z"
            },
            "errors": {
                "device_code": ["Device with code 'INVALID-DEVICE' does not exist or is inactive."]
            }
        }
    ]
}
```

| Field | Type | Description |
|-------|------|-------------|
| `status` | string | `"success"` (even with partial failures) |
| `created_count` | integer | Number of records successfully created |
| `failed_count` | integer | Number of records that failed validation |
| `created` | array | Details of successfully created records |
| `errors` | array | Details of failed records with error messages |

**Error Response (400 Bad Request):**

```json
{
    "status": "error",
    "errors": {
        "non_field_errors": ["Expected a list of telemetry records."]
    }
}
```

---

### 3. Parking Log Event

Records a parking occupancy change event (slot becomes occupied or free).

**Endpoint:** `POST /api/parking-log/`

**Request Body:**

```json
{
    "device_code": "DEV-B1-001",
    "is_occupied": true,
    "timestamp": "2026-02-18T10:35:00Z"
}
```

**Request Parameters:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `device_code` | string | Yes | Unique device identifier |
| `is_occupied` | boolean | Yes | `true` = occupied, `false` = free |
| `timestamp` | datetime | Yes | ISO 8601 timestamp of the event |

**Success Response (201 Created):**

```json
{
    "status": "success",
    "message": "Parking log recorded.",
    "device_code": "DEV-B1-001",
    "is_occupied": true,
    "timestamp": "2026-02-18T10:35:00Z"
}
```

---

## Dashboard APIs

### 4. Dashboard Summary

Returns aggregated statistics for the dashboard including occupancy rates, device status, alerts, efficiency metrics, and per-zone breakdown.

**Endpoint:** `GET /api/dashboard/summary/`

**Query Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `date` | string | No | Date filter (YYYY-MM-DD). Defaults to today. |
| `facility` | integer | No | Filter all data by facility ID |

**Example Request:**

```
GET /api/dashboard/summary/?date=2026-02-18&facility=1
```

**Success Response (200 OK):**

```json
{
    "date": "2026-02-18",
    "total_slots": 50,
    "total_occupied": 32,
    "total_available": 18,
    "occupancy_rate": 64.0,
    "total_parking_events": 342,
    "active_devices": 48,
    "avg_health_score": 82.5,
    "alerts": {
        "total": 5,
        "critical": 1,
        "warning": 3,
        "info": 1,
        "triggered_on_date": 3
    },
    "efficiency": {
        "target_usage": 160,
        "actual_usage": 120,
        "efficiency_percentage": 75.0
    },
    "zones": [
        {
            "id": 1,
            "name": "Basement-1",
            "zone_type": "BASEMENT",
            "facility_name": "City Center Mall Parking",
            "total_slots": 20,
            "occupied": 13,
            "available": 7,
            "occupancy_rate": 65.0,
            "target_usage": 60,
            "actual_usage": 45,
            "efficiency_percentage": 75.0
        }
    ]
}
```

**Response Fields:**

| Field | Type | Description |
|-------|------|-------------|
| `date` | string | The date for which data is returned |
| `total_slots` | integer | Total active parking slots |
| `total_occupied` | integer | Currently occupied slots (based on latest ParkingLog) |
| `total_available` | integer | `total_slots - total_occupied` |
| `occupancy_rate` | float | `(total_occupied / total_slots) × 100` |
| `total_parking_events` | integer | Total ParkingLog records for the date |
| `active_devices` | integer | Count of devices with `is_active=True` |
| `avg_health_score` | float | Average health score across active devices |
| `alerts.total` | integer | Total unacknowledged alerts |
| `alerts.critical` | integer | Unacknowledged CRITICAL alerts |
| `alerts.warning` | integer | Unacknowledged WARNING alerts |
| `alerts.info` | integer | Unacknowledged INFO alerts |
| `alerts.triggered_on_date` | integer | Alerts created on the specified date |
| `efficiency.target_usage` | integer | Sum of target_occupancy_count from ParkingTarget |
| `efficiency.actual_usage` | integer | Sum of actual occupied ParkingLog records |
| `efficiency.efficiency_percentage` | float | `(actual / target) × 100` |
| `zones[].id` | integer | Zone ID |
| `zones[].name` | string | Zone name |
| `zones[].zone_type` | string | BASEMENT, OUTDOOR, VIP, or ROOFTOP |
| `zones[].facility_name` | string | Parent facility name |
| `zones[].total_slots` | integer | Slots in this zone |
| `zones[].occupied` | integer | Currently occupied slots |
| `zones[].available` | integer | Available slots |
| `zones[].occupancy_rate` | float | Zone occupancy percentage |
| `zones[].target_usage` | integer | Zone's daily target occupancy count |
| `zones[].actual_usage` | integer | Zone's actual occupied events for the date |
| `zones[].efficiency_percentage` | float | Zone-level efficiency |

---

### 5. Hourly Usage Data

Returns a 24-element array with hourly parking usage, target occupancy, and last week's data for comparison.

**Endpoint:** `GET /api/dashboard/hourly/`

**Query Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `date` | string | No | Date (YYYY-MM-DD). Defaults to today. |
| `zone` | integer | No | Filter by zone ID |

**Example Request:**

```
GET /api/dashboard/hourly/?date=2026-02-18&zone=1
```

**Success Response (200 OK):**

```json
{
    "date": "2026-02-18",
    "zone_id": "1",
    "hourly": [
        {
            "hour": 0,
            "label": "00:00",
            "occupied_events": 3,
            "target": 6.7,
            "last_week": 2
        },
        {
            "hour": 1,
            "label": "01:00",
            "occupied_events": 1,
            "target": 6.7,
            "last_week": 1
        },
        {
            "hour": 8,
            "label": "08:00",
            "occupied_events": 45,
            "target": 6.7,
            "last_week": 38
        }
    ]
}
```

**Response Fields:**

| Field | Type | Description |
|-------|------|-------------|
| `date` | string | The date queried |
| `zone_id` | string | Zone ID filter applied (or null) |
| `hourly` | array | 24 elements, one per hour (00–23) |
| `hourly[].hour` | integer | Hour of the day (0–23) |
| `hourly[].label` | string | Formatted hour label (e.g., "08:00") |
| `hourly[].occupied_events` | integer | Count of `is_occupied=True` ParkingLog records for this hour |
| `hourly[].target` | float | Daily target divided by 24 (hourly share) |
| `hourly[].last_week` | integer | Same hour's occupied events from 7 days ago |

---

## Alert Management APIs

### 6. List Alerts

Returns a list of system alerts with optional filtering.

**Endpoint:** `GET /api/alerts/`

**Query Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `severity` | string | No | Filter by severity: `INFO`, `WARNING`, `CRITICAL` |
| `acknowledged` | string | No | Filter by acknowledgment: `true` or `false` |
| `type` | string | No | Filter by type: `DEVICE_OFFLINE`, `HIGH_POWER`, `INVALID_DATA`, `LOW_HEALTH` |

**Example Requests:**

```
GET /api/alerts/
GET /api/alerts/?severity=CRITICAL
GET /api/alerts/?acknowledged=false
GET /api/alerts/?severity=WARNING&type=HIGH_POWER
```

**Success Response (200 OK):**

```json
[
    {
        "id": 1,
        "device_code": "DEV-B1-005",
        "zone_name": "Basement-1",
        "alert_type": "DEVICE_OFFLINE",
        "severity": "CRITICAL",
        "message": "Device DEV-B1-005 has not sent data for over 2 minutes.",
        "is_acknowledged": false,
        "acknowledged_at": null,
        "created_at": "2026-02-18T10:25:00Z"
    },
    {
        "id": 2,
        "device_code": "DEV-B2-012",
        "zone_name": "Basement-2",
        "alert_type": "HIGH_POWER",
        "severity": "WARNING",
        "message": "Device DEV-B2-012 reported power consumption of 1650.0W (threshold: 1500W).",
        "is_acknowledged": false,
        "acknowledged_at": null,
        "created_at": "2026-02-18T10:20:00Z"
    }
]
```

**Response Fields:**

| Field | Type | Description |
|-------|------|-------------|
| `id` | integer | Unique alert ID |
| `device_code` | string/null | Device that triggered the alert |
| `zone_name` | string/null | Zone associated with the alert |
| `alert_type` | string | `DEVICE_OFFLINE`, `HIGH_POWER`, `INVALID_DATA`, `LOW_HEALTH` |
| `severity` | string | `INFO`, `WARNING`, `CRITICAL` |
| `message` | string | Human-readable alert description |
| `is_acknowledged` | boolean | Whether alert has been acknowledged |
| `acknowledged_at` | datetime/null | Timestamp of acknowledgment |
| `created_at` | datetime | When the alert was created |

**Note:** Results are limited to 200 records, ordered by `-created_at` (newest first).

---

### 7. Acknowledge Alert

Marks an alert as acknowledged.

**Endpoint:** `PATCH /api/alerts/{id}/acknowledge/`

**Path Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | integer | Yes | Alert ID to acknowledge |

**Example Request:**

```
PATCH /api/alerts/1/acknowledge/
```

**Success Response (200 OK):**

```json
{
    "status": "success",
    "message": "Alert acknowledged.",
    "alert_id": 1,
    "acknowledged_at": "2026-02-18T10:30:00Z"
}
```

**Already Acknowledged (200 OK):**

```json
{
    "status": "info",
    "message": "Alert already acknowledged."
}
```

**Error Response (404 Not Found):**

```json
{
    "status": "error",
    "message": "Alert not found."
}
```

---

## Resource APIs

### 8. List Facilities

Returns all parking facilities.

**Endpoint:** `GET /api/facilities/`

**Success Response (200 OK):**

```json
[
    {
        "id": 1,
        "name": "City Center Mall Parking",
        "address": "123 Main Street, City Center",
        "is_active": true,
        "zone_count": 4,
        "created_at": "2026-01-01T00:00:00Z"
    }
]
```

---

### 9. List Zones

Returns parking zones with optional facility filter.

**Endpoint:** `GET /api/zones/`

**Query Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `facility` | integer | No | Filter by facility ID |

**Success Response (200 OK):**

```json
[
    {
        "id": 1,
        "name": "Basement-1",
        "facility_name": "City Center Mall Parking",
        "zone_type": "BASEMENT",
        "total_slots": 20,
        "occupied_count": 13,
        "is_active": true,
        "created_at": "2026-01-01T00:00:00Z"
    },
    {
        "id": 4,
        "name": "VIP",
        "facility_name": "City Center Mall Parking",
        "zone_type": "VIP",
        "total_slots": 5,
        "occupied_count": 3,
        "is_active": true,
        "created_at": "2026-01-01T00:00:00Z"
    }
]
```

---

### 10. List Devices

Returns all IoT devices with their current status and health.

**Endpoint:** `GET /api/devices/`

**Query Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `zone` | integer | No | Filter by zone ID |
| `active` | string | No | Filter by active status: `true` or `false` |
| `search` | string | No | Search by device_code (case-insensitive contains) |

**Success Response (200 OK):**

```json
[
    {
        "id": 1,
        "device_code": "DEV-B1-001",
        "slot_number": "B1-01",
        "zone_name": "Basement-1",
        "zone_id": 1,
        "facility_name": "City Center Mall Parking",
        "is_active": true,
        "health_score": 95,
        "last_seen_at": "2026-02-18T10:29:00Z",
        "installed_at": "2026-01-15T08:00:00Z"
    }
]
```

**Health Score Interpretation:**

| Score Range | Status | Color |
|-------------|--------|-------|
| 80–100 | Healthy | Green |
| 50–79 | Degraded | Orange |
| 0–49 | Critical | Red |

---

### 11. List Parking Logs

Returns parking occupancy event history.

**Endpoint:** `GET /api/parking-logs/`

**Query Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `zone` | integer | No | Filter by zone ID |
| `date` | string | No | Filter by date (YYYY-MM-DD) |

**Success Response (200 OK):**

```json
[
    {
        "id": 1,
        "device_code": "DEV-B1-001",
        "zone_name": "Basement-1",
        "is_occupied": true,
        "timestamp": "2026-02-18T10:35:00Z",
        "received_at": "2026-02-18T10:35:01Z"
    }
]
```

**Note:** Results are limited to 200 records, ordered by `-timestamp` (newest first).

---

### 12. List Parking Targets

Returns daily parking usage targets per zone with computed efficiency.

**Endpoint:** `GET /api/targets/`

**Query Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `date` | string | No | Filter by date (YYYY-MM-DD). Defaults to today. |

**Success Response (200 OK):**

```json
[
    {
        "id": 1,
        "zone_name": "Basement-1",
        "date": "2026-02-18",
        "target_occupancy_count": 40,
        "actual_usage": 34,
        "efficiency": 85.0
    },
    {
        "id": 2,
        "zone_name": "VIP",
        "date": "2026-02-18",
        "target_occupancy_count": 15,
        "actual_usage": 12,
        "efficiency": 80.0
    }
]
```

**Response Fields:**

| Field | Type | Description |
|-------|------|-------------|
| `id` | integer | Target record ID |
| `zone_name` | string | Name of the zone |
| `date` | string | Target date |
| `target_occupancy_count` | integer | Expected occupied slots |
| `actual_usage` | integer | Actual occupied events (computed at query time) |
| `efficiency` | float | `(actual_usage / target_occupancy_count) × 100` |

---

## Data Models

### Entity Relationship

```
ParkingFacility (1) ──── (N) ParkingZone (1) ──── (N) ParkingSlot (1) ──── (1) Device
                                   │                                            │
                                   │                                     ┌──────┴──────┐
                              ParkingTarget                              │             │
                                                                   TelemetryData  ParkingLog
                                                                                       
                                                                       Alert
                                                              (FK device, FK zone — both nullable)
```

### Model Schemas

#### ParkingFacility
| Field | Type | Constraints |
|-------|------|-------------|
| id | integer | Primary Key, Auto |
| name | string(200) | Required |
| address | text | Optional |
| is_active | boolean | Default: true |
| created_at | datetime | Auto |
| updated_at | datetime | Auto |

#### ParkingZone
| Field | Type | Constraints |
|-------|------|-------------|
| id | integer | Primary Key, Auto |
| facility_id | integer | Foreign Key → ParkingFacility |
| name | string(100) | Required |
| zone_type | enum | BASEMENT, OUTDOOR, VIP, ROOFTOP |
| total_slots | integer | Default: 0 |
| is_active | boolean | Default: true |
| created_at | datetime | Auto |

**Unique constraint:** `(facility_id, name)`

#### ParkingSlot
| Field | Type | Constraints |
|-------|------|-------------|
| id | integer | Primary Key, Auto |
| zone_id | integer | Foreign Key → ParkingZone |
| slot_number | string(20) | Required |
| is_active | boolean | Default: true |

**Unique constraint:** `(zone_id, slot_number)`

#### Device
| Field | Type | Constraints |
|-------|------|-------------|
| id | integer | Primary Key, Auto |
| slot_id | integer | Foreign Key → ParkingSlot, Unique (OneToOne) |
| device_code | string(50) | Unique, Indexed |
| is_active | boolean | Default: true |
| last_seen_at | datetime | Nullable |
| health_score | integer | 0–100, Default: 100 |
| installed_at | datetime | Auto |

#### TelemetryData
| Field | Type | Constraints |
|-------|------|-------------|
| id | integer | Primary Key, Auto |
| device_id | integer | Foreign Key → Device |
| voltage | float | Required |
| current | float | Required |
| power_factor | float | Required |
| power_consumption | float | Computed on save: `voltage × current × power_factor` |
| timestamp | datetime | Indexed |
| received_at | datetime | Auto |

**Unique constraint:** `(device_id, timestamp)`

#### ParkingLog
| Field | Type | Constraints |
|-------|------|-------------|
| id | integer | Primary Key, Auto |
| device_id | integer | Foreign Key → Device |
| is_occupied | boolean | Required |
| timestamp | datetime | Indexed |
| received_at | datetime | Auto |

#### Alert
| Field | Type | Constraints |
|-------|------|-------------|
| id | integer | Primary Key, Auto |
| device_id | integer | Foreign Key → Device, Nullable |
| zone_id | integer | Foreign Key → ParkingZone, Nullable |
| alert_type | enum | DEVICE_OFFLINE, HIGH_POWER, INVALID_DATA, LOW_HEALTH |
| severity | enum | INFO, WARNING, CRITICAL |
| message | text | Required |
| is_acknowledged | boolean | Default: false |
| acknowledged_at | datetime | Nullable |
| created_at | datetime | Auto |

#### ParkingTarget
| Field | Type | Constraints |
|-------|------|-------------|
| id | integer | Primary Key, Auto |
| zone_id | integer | Foreign Key → ParkingZone |
| date | date | Indexed |
| target_occupancy_count | integer | Required |
| target_usage_hours | integer | Default: 0 |
| created_at | datetime | Auto |

**Unique constraint:** `(zone_id, date)`

---

## Error Handling

### Standard Error Response Format

```json
{
    "status": "error",
    "errors": {
        "field_name": ["Error message 1", "Error message 2"],
        "non_field_errors": ["General error message"]
    }
}
```

### HTTP Status Codes

| Code | Description |
|------|-------------|
| `200 OK` | Successful GET, PATCH |
| `201 Created` | Successful POST |
| `400 Bad Request` | Validation error |
| `404 Not Found` | Resource not found |
| `500 Internal Server Error` | Server error |

### Common Validation Errors

| Error | Cause |
|-------|-------|
| `Device with code 'X' does not exist or is inactive.` | Invalid or inactive device_code |
| `Timestamp cannot be in the future.` | Future timestamp provided |
| `Duplicate telemetry: a record for this device already exists within a 1-minute window.` | Duplicate within ±1 minute |
| `Expected a list of telemetry records.` | Bulk endpoint received non-array |
| `The list cannot be empty.` | Empty array for bulk endpoint |

---

## Alert Detection Logic

Alerts are automatically generated when telemetry is ingested. After each telemetry save, `run_all_detections()` is called which checks for HIGH_POWER, INVALID_DATA, and LOW_HEALTH conditions. DEVICE_OFFLINE is checked via `detect_offline_devices()` (manual/scheduled).

### 1. Device Offline Alert
- **Trigger:** Device `last_seen_at` is older than 2 minutes
- **Severity:** CRITICAL
- **Type:** `DEVICE_OFFLINE`
- **Detection:** `detect_offline_devices()` — must be called externally

### 2. High Power Usage Alert
- **Trigger:** `power_consumption` > 1,500 Watts
- **Severity:** WARNING
- **Type:** `HIGH_POWER`
- **Detection:** Inline after telemetry save

### 3. Invalid Data Alert
- **Trigger:** Voltage < 100V or > 300V
- **Severity:** WARNING
- **Type:** `INVALID_DATA`
- **Detection:** Inline after telemetry save

### 4. Low Health Score Alert
- **Trigger:** Device `health_score` < 30
- **Severity:** INFO
- **Type:** `LOW_HEALTH`
- **Detection:** Inline after health score recomputation

### Duplicate Alert Prevention

Before creating any alert, the system checks for an existing **unacknowledged** alert of the same `alert_type` for the same `device`. If one exists, no new alert is created. This prevents alert storms during sustained fault conditions.

### Health Score Calculation

Device health score (0–100) is computed using weighted factors after each telemetry ingestion:

| Factor | Weight | Scoring |
|--------|--------|---------|
| Recency | 40% | 100 if ≤ 2 min; linear decay 100→0 over 2–60 min; 0 if > 60 min |
| Voltage | 20% | 100 if avg 200–250V; 60 if 150–200V or 250–300V; 20 otherwise |
| Power | 20% | 100 if avg ≤ 1,500W; 50 if ≤ 2,250W; 10 otherwise |
| Alerts | 20% | 100 if 0 open alerts; 60 if ≤ 2; 20 if > 2 |

Voltage and power scores use **1-hour rolling averages** from recent telemetry.

---

## Testing with cURL

```bash
# Seed the database
python manage.py seed_data

# Test Dashboard Summary
curl http://localhost:8000/api/dashboard/summary/?date=2026-02-18

# Test Dashboard Summary with facility filter
curl http://localhost:8000/api/dashboard/summary/?date=2026-02-18&facility=1

# Test Hourly Usage
curl http://localhost:8000/api/dashboard/hourly/?date=2026-02-18&zone=1

# Test Telemetry Ingestion
curl -X POST http://localhost:8000/api/telemetry/ \
  -H "Content-Type: application/json" \
  -d '{"device_code":"DEV-B1-001","voltage":220,"current":1.2,"power_factor":0.95,"timestamp":"2026-02-18T10:30:00Z"}'

# Test Bulk Telemetry
curl -X POST http://localhost:8000/api/telemetry/bulk/ \
  -H "Content-Type: application/json" \
  -d '[{"device_code":"DEV-B1-001","voltage":220,"current":1.2,"power_factor":0.95,"timestamp":"2026-02-18T11:00:00Z"}]'

# Test Parking Log
curl -X POST http://localhost:8000/api/parking-log/ \
  -H "Content-Type: application/json" \
  -d '{"device_code":"DEV-B1-001","is_occupied":true,"timestamp":"2026-02-18T10:35:00Z"}'

# List Alerts (unacknowledged only)
curl http://localhost:8000/api/alerts/?acknowledged=false

# Acknowledge an Alert
curl -X PATCH http://localhost:8000/api/alerts/1/acknowledge/

# List Devices (search + zone filter)
curl "http://localhost:8000/api/devices/?search=DEV-B1&zone=1&active=true"

# List Zones (by facility)
curl http://localhost:8000/api/zones/?facility=1

# List Targets
curl http://localhost:8000/api/targets/?date=2026-02-18
```

---

## Changelog

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | 2026-02-18 | Initial API documentation |
| 1.1.0 | 2026-02-18 | Updated to match actual implementation: corrected response shapes, parameter names, hourly endpoint fields (target, last_week), facility filter on dashboard summary, 1-minute duplicate window, alert severities, health score thresholds |
