# Smart Car Parking Monitoring & Alert System - API Documentation

## Overview

This document provides comprehensive API documentation for the Smart Car Parking Monitoring & Alert System. The API is built using Django REST Framework and follows RESTful conventions.

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

Ingests a single telemetry record from an IoT device.

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
| `device_code` | string | ✅ | Unique device identifier (max 50 chars) |
| `voltage` | float | ✅ | Voltage reading in Volts |
| `current` | float | ✅ | Current reading in Amperes |
| `power_factor` | float | ✅ | Power factor (0.0 to 1.0) |
| `timestamp` | datetime | ✅ | ISO 8601 timestamp of the reading |

**Success Response (201 Created):**

```json
{
    "status": "success",
    "data": {
        "device_code": "DEV-B1-001",
        "voltage": 220.5,
        "current": 1.2,
        "power_factor": 0.95,
        "power_consumption": 251.37,
        "timestamp": "2026-02-18T10:30:00Z",
        "health_score": 95,
        "alerts_triggered": []
    }
}
```

**Error Responses:**

- `400 Bad Request` - Validation error (invalid device, future timestamp, duplicate)

```json
{
    "device_code": ["Device with code 'INVALID' does not exist or is inactive."]
}
```

```json
{
    "timestamp": ["Timestamp cannot be in the future."]
}
```

```json
{
    "non_field_errors": ["Duplicate telemetry: a record for this device and timestamp already exists."]
}
```

---

### 2. Bulk Telemetry Ingestion

Ingests multiple telemetry records in a single request. Validates each record independently.

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
    "status": "partial",
    "summary": {
        "total": 3,
        "created": 2,
        "failed": 1
    },
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
| `device_code` | string | ✅ | Unique device identifier |
| `is_occupied` | boolean | ✅ | `true` = occupied, `false` = free |
| `timestamp` | datetime | ✅ | ISO 8601 timestamp of the event |

**Success Response (201 Created):**

```json
{
    "status": "success",
    "data": {
        "id": 1,
        "device_code": "DEV-B1-001",
        "is_occupied": true,
        "timestamp": "2026-02-18T10:35:00Z"
    }
}
```

---

## Dashboard APIs

### 4. Dashboard Summary

Returns aggregated statistics for the dashboard including occupancy rates, device status, and alerts.

**Endpoint:** `GET /api/dashboard/summary/`

**Query Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `date` | string | ❌ | Date filter (YYYY-MM-DD). Defaults to today. |
| `facility_id` | integer | ❌ | Filter by facility ID |

**Example Request:**

```
GET /api/dashboard/summary/?date=2026-02-18&facility_id=1
```

**Success Response (200 OK):**

```json
{
    "date": "2026-02-18",
    "total_slots": 150,
    "total_occupied": 87,
    "occupancy_rate": 58.0,
    "total_parking_events": 342,
    "active_devices": 148,
    "alerts": {
        "total": 5,
        "critical": 1,
        "warning": 3,
        "info": 1
    },
    "efficiency": {
        "target": 80.0,
        "actual": 72.5,
        "variance": -7.5
    },
    "zones": [
        {
            "id": 1,
            "name": "Basement Level 1",
            "total_slots": 50,
            "occupied": 32,
            "occupancy_percentage": 64.0,
            "efficiency_percentage": 85.3
        },
        {
            "id": 2,
            "name": "Basement Level 2",
            "total_slots": 50,
            "occupied": 28,
            "occupancy_percentage": 56.0,
            "efficiency_percentage": 70.0
        },
        {
            "id": 3,
            "name": "VIP Zone",
            "total_slots": 50,
            "occupied": 27,
            "occupancy_percentage": 54.0,
            "efficiency_percentage": 67.5
        }
    ]
}
```

**Response Fields:**

| Field | Type | Description |
|-------|------|-------------|
| `date` | string | The date for which data is returned |
| `total_slots` | integer | Total parking slots across all zones |
| `total_occupied` | integer | Currently occupied slots |
| `occupancy_rate` | float | Percentage of occupied slots |
| `total_parking_events` | integer | Total parking events for the day |
| `active_devices` | integer | Number of devices that reported in last 2 minutes |
| `alerts.total` | integer | Total unacknowledged alerts |
| `alerts.critical` | integer | Critical severity alerts |
| `alerts.warning` | integer | Warning severity alerts |
| `alerts.info` | integer | Info severity alerts |
| `efficiency.target` | float | Target occupancy percentage |
| `efficiency.actual` | float | Actual occupancy percentage |
| `efficiency.variance` | float | Difference (actual - target) |
| `zones` | array | Per-zone breakdown |

---

### 5. Hourly Usage Data

Returns hourly parking usage statistics for charts and trends.

**Endpoint:** `GET /api/dashboard/hourly/`

**Query Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `date` | string | ❌ | Date filter (YYYY-MM-DD). Defaults to today. |
| `zone_id` | integer | ❌ | Filter by specific zone ID |

**Example Request:**

```
GET /api/dashboard/hourly/?date=2026-02-18&zone_id=1
```

**Success Response (200 OK):**

```json
[
    {
        "hour": "00:00",
        "occupied_count": 12
    },
    {
        "hour": "01:00",
        "occupied_count": 8
    },
    {
        "hour": "02:00",
        "occupied_count": 5
    },
    {
        "hour": "08:00",
        "occupied_count": 45
    },
    {
        "hour": "09:00",
        "occupied_count": 78
    },
    {
        "hour": "10:00",
        "occupied_count": 85
    }
]
```

**Response Fields:**

| Field | Type | Description |
|-------|------|-------------|
| `hour` | string | Hour of the day (HH:00 format) |
| `occupied_count` | integer | Number of occupied slots during that hour |

---

## Alert Management APIs

### 6. List Alerts

Returns a list of system alerts with optional filtering.

**Endpoint:** `GET /api/alerts/`

**Query Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `severity` | string | ❌ | Filter by severity: `INFO`, `WARNING`, `CRITICAL` |
| `acknowledged` | boolean | ❌ | Filter by acknowledgment status: `true` or `false` |
| `alert_type` | string | ❌ | Filter by type: `DEVICE_OFFLINE`, `HIGH_POWER`, `INVALID_DATA`, `LOW_HEALTH` |

**Example Requests:**

```
GET /api/alerts/
GET /api/alerts/?severity=CRITICAL
GET /api/alerts/?acknowledged=false
GET /api/alerts/?severity=WARNING&acknowledged=false
```

**Success Response (200 OK):**

```json
[
    {
        "id": 1,
        "device_code": "DEV-B1-005",
        "zone_name": "Basement Level 1",
        "alert_type": "DEVICE_OFFLINE",
        "severity": "CRITICAL",
        "message": "Device DEV-B1-005 has not reported for 5 minutes.",
        "is_acknowledged": false,
        "acknowledged_at": null,
        "created_at": "2026-02-18T10:25:00Z"
    },
    {
        "id": 2,
        "device_code": "DEV-B2-012",
        "zone_name": "Basement Level 2",
        "alert_type": "HIGH_POWER",
        "severity": "WARNING",
        "message": "Device DEV-B2-012 power consumption (1650W) exceeds threshold (1500W).",
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
| `device_code` | string | Device that triggered the alert (nullable) |
| `zone_name` | string | Zone associated with the alert (nullable) |
| `alert_type` | string | Type of alert |
| `severity` | string | Alert severity level |
| `message` | string | Human-readable alert description |
| `is_acknowledged` | boolean | Whether alert has been acknowledged |
| `acknowledged_at` | datetime | Timestamp of acknowledgment (nullable) |
| `created_at` | datetime | When the alert was created |

---

### 7. Acknowledge Alert

Marks an alert as acknowledged.

**Endpoint:** `PATCH /api/alerts/{id}/acknowledge/`

**Path Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | integer | ✅ | Alert ID to acknowledge |

**Example Request:**

```
PATCH /api/alerts/1/acknowledge/
```

**Success Response (200 OK):**

```json
{
    "id": 1,
    "device_code": "DEV-B1-005",
    "zone_name": "Basement Level 1",
    "alert_type": "DEVICE_OFFLINE",
    "severity": "CRITICAL",
    "message": "Device DEV-B1-005 has not reported for 5 minutes.",
    "is_acknowledged": true,
    "acknowledged_at": "2026-02-18T10:30:00Z",
    "created_at": "2026-02-18T10:25:00Z"
}
```

**Error Response (404 Not Found):**

```json
{
    "detail": "Not found."
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
        "name": "Downtown Parking Complex",
        "address": "123 Main Street, City Center",
        "is_active": true,
        "zone_count": 3,
        "created_at": "2026-01-01T00:00:00Z"
    }
]
```

---

### 9. List Zones

Returns all parking zones.

**Endpoint:** `GET /api/zones/`

**Query Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `facility_id` | integer | ❌ | Filter by facility ID |

**Success Response (200 OK):**

```json
[
    {
        "id": 1,
        "name": "Basement Level 1",
        "facility_name": "Downtown Parking Complex",
        "zone_type": "BASEMENT",
        "total_slots": 50,
        "occupied_count": 32,
        "is_active": true,
        "created_at": "2026-01-01T00:00:00Z"
    },
    {
        "id": 2,
        "name": "VIP Zone",
        "facility_name": "Downtown Parking Complex",
        "zone_type": "VIP",
        "total_slots": 20,
        "occupied_count": 15,
        "is_active": true,
        "created_at": "2026-01-01T00:00:00Z"
    }
]
```

---

### 10. List Devices

Returns all IoT devices with their status.

**Endpoint:** `GET /api/devices/`

**Query Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `zone_id` | integer | ❌ | Filter by zone ID |
| `is_active` | boolean | ❌ | Filter by active status |

**Success Response (200 OK):**

```json
[
    {
        "id": 1,
        "device_code": "DEV-B1-001",
        "slot_number": "A-01",
        "zone_name": "Basement Level 1",
        "zone_id": 1,
        "facility_name": "Downtown Parking Complex",
        "is_active": true,
        "health_score": 95,
        "last_seen_at": "2026-02-18T10:29:00Z",
        "installed_at": "2026-01-15T08:00:00Z"
    },
    {
        "id": 2,
        "device_code": "DEV-B1-002",
        "slot_number": "A-02",
        "zone_name": "Basement Level 1",
        "zone_id": 1,
        "facility_name": "Downtown Parking Complex",
        "is_active": true,
        "health_score": 78,
        "last_seen_at": "2026-02-18T10:28:00Z",
        "installed_at": "2026-01-15T08:00:00Z"
    }
]
```

**Health Score Interpretation:**

| Score Range | Status | Color |
|-------------|--------|-------|
| 80-100 | Healthy | 🟢 Green |
| 50-79 | Degraded | 🟡 Orange |
| 0-49 | Critical | 🔴 Red |

---

### 11. List Parking Logs

Returns parking occupancy event history.

**Endpoint:** `GET /api/parking-logs/`

**Query Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `device_code` | string | ❌ | Filter by device code |
| `date` | string | ❌ | Filter by date (YYYY-MM-DD) |

**Success Response (200 OK):**

```json
[
    {
        "id": 1,
        "device_code": "DEV-B1-001",
        "zone_name": "Basement Level 1",
        "is_occupied": true,
        "timestamp": "2026-02-18T10:35:00Z",
        "received_at": "2026-02-18T10:35:01Z"
    },
    {
        "id": 2,
        "device_code": "DEV-B1-001",
        "zone_name": "Basement Level 1",
        "is_occupied": false,
        "timestamp": "2026-02-18T09:15:00Z",
        "received_at": "2026-02-18T09:15:01Z"
    }
]
```

---

### 12. List Parking Targets

Returns daily parking usage targets per zone for efficiency tracking.

**Endpoint:** `GET /api/targets/`

**Query Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `date` | string | ❌ | Filter by date (YYYY-MM-DD) |
| `zone_id` | integer | ❌ | Filter by zone ID |

**Success Response (200 OK):**

```json
[
    {
        "id": 1,
        "zone_name": "Basement Level 1",
        "date": "2026-02-18",
        "target_occupancy_count": 40,
        "actual_usage": 34,
        "efficiency": 85.0
    },
    {
        "id": 2,
        "zone_name": "VIP Zone",
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
| `actual_usage` | integer | Actual occupied events (computed) |
| `efficiency` | float | (actual / target) × 100 |

---

## Data Models

### Entity Relationship

```
ParkingFacility (1) ──── (N) ParkingZone (1) ──── (N) ParkingSlot (1) ──── (1) Device
                                   │                                            │
                                   │                                            │
                              ParkingTarget                              ┌──────┴──────┐
                                                                         │             │
                                                                   TelemetryData  ParkingLog
                                                                                       │
                                                                                     Alert
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
| facility_id | integer | Foreign Key |
| name | string(100) | Required |
| zone_type | enum | BASEMENT, OUTDOOR, VIP, ROOFTOP |
| total_slots | integer | Default: 0 |
| is_active | boolean | Default: true |
| created_at | datetime | Auto |

#### Device
| Field | Type | Constraints |
|-------|------|-------------|
| id | integer | Primary Key, Auto |
| slot_id | integer | Foreign Key, Unique |
| device_code | string(50) | Unique, Indexed |
| is_active | boolean | Default: true |
| last_seen_at | datetime | Nullable |
| health_score | integer | 0-100, Default: 100 |
| installed_at | datetime | Auto |

#### TelemetryData
| Field | Type | Constraints |
|-------|------|-------------|
| id | integer | Primary Key, Auto |
| device_id | integer | Foreign Key |
| voltage | float | Required |
| current | float | Required |
| power_factor | float | Required |
| power_consumption | float | Computed, Read-only |
| timestamp | datetime | Indexed |
| received_at | datetime | Auto |

**Unique Constraint:** (device_id, timestamp)

#### Alert
| Field | Type | Constraints |
|-------|------|-------------|
| id | integer | Primary Key, Auto |
| device_id | integer | Foreign Key, Nullable |
| zone_id | integer | Foreign Key, Nullable |
| alert_type | enum | DEVICE_OFFLINE, HIGH_POWER, INVALID_DATA, LOW_HEALTH |
| severity | enum | INFO, WARNING, CRITICAL |
| message | text | Required |
| is_acknowledged | boolean | Default: false |
| acknowledged_at | datetime | Nullable |
| created_at | datetime | Auto |

---

## Error Handling

### Standard Error Response Format

```json
{
    "field_name": ["Error message 1", "Error message 2"],
    "non_field_errors": ["General error message"]
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
| `Device with code 'X' does not exist or is inactive.` | Invalid device_code |
| `Timestamp cannot be in the future.` | Future timestamp |
| `Duplicate telemetry: a record for this device and timestamp already exists.` | Duplicate record |
| `Expected a list of telemetry records.` | Bulk endpoint received non-array |
| `The list cannot be empty.` | Empty array for bulk |

---

## Alert Detection Logic

Alerts are automatically generated when telemetry is ingested based on the following rules:

### 1. Device Offline Alert
- **Trigger:** Device hasn't reported for > 2 minutes
- **Severity:** CRITICAL
- **Type:** `DEVICE_OFFLINE`

### 2. High Power Usage Alert
- **Trigger:** `power_consumption` > 1500 Watts
- **Severity:** WARNING
- **Type:** `HIGH_POWER`

### 3. Invalid Data Alert
- **Trigger:** Voltage outside 100V - 300V range
- **Severity:** WARNING
- **Type:** `INVALID_DATA`

### 4. Low Health Score Alert
- **Trigger:** Device `health_score` < 30
- **Severity:** CRITICAL
- **Type:** `LOW_HEALTH`

### Health Score Calculation

Device health score (0-100) is computed using weighted factors:

| Factor | Weight | Calculation |
|--------|--------|-------------|
| Recency | 40% | Based on time since last telemetry |
| Voltage | 20% | Penalty for readings outside 200-240V |
| Power | 20% | Penalty for consumption > 1000W |
| Alerts | 20% | Penalty for recent alerts |

---

## Rate Limiting

Currently no rate limiting is applied. For production:
- Recommended: 100 requests/minute for ingestion endpoints
- Recommended: 1000 requests/minute for read endpoints

---

## Postman Collection

Import the following collection for quick testing:

**Collection URL:** [SmartPark_API_Collection.json](./postman/SmartPark_API_Collection.json)

Or manually test using:

```bash
# Test Dashboard Summary
curl http://localhost:8000/api/dashboard/summary/?date=2026-02-18

# Test Telemetry Ingestion
curl -X POST http://localhost:8000/api/telemetry/ \
  -H "Content-Type: application/json" \
  -d '{"device_code":"DEV-B1-001","voltage":220,"current":1.2,"power_factor":0.95,"timestamp":"2026-02-18T10:30:00Z"}'

# Test Alert List
curl http://localhost:8000/api/alerts/?acknowledged=false
```

---

## Changelog

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | 2026-02-18 | Initial API documentation |

---

*
