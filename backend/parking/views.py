from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView

from .serializers import (
    TelemetrySerializer,
    BulkTelemetrySerializer,
    ParkingLogSerializer,
    ParkingLogListSerializer,
    AlertSerializer,
    FacilitySerializer,
    ZoneSerializer,
    DeviceSerializer,
    ParkingTargetSerializer,
)
from .models import (
    ParkingLog,
    Alert,
    ParkingFacility,
    ParkingZone,
    Device,
    ParkingSlot,
    TelemetryData,
    ParkingTarget,
)


class TelemetryCreateView(APIView):
    """
    POST /api/telemetry/
    Ingest a single telemetry record from a parking device.
    """

    def post(self, request):
        serializer = TelemetrySerializer(data=request.data)
        if serializer.is_valid():
            telemetry = serializer.save()
            return Response(
                {
                    "status": "success",
                    "message": "Telemetry data recorded.",
                    "device_code": telemetry.device.device_code,
                    "power_consumption": telemetry.power_consumption,
                    "timestamp": telemetry.timestamp,
                    "alerts_triggered": getattr(telemetry, "alerts_triggered", []),
                    "health_score": getattr(telemetry, "health_score", None),
                },
                status=status.HTTP_201_CREATED,
            )
        return Response(
            {"status": "error", "errors": serializer.errors},
            status=status.HTTP_400_BAD_REQUEST,
        )


class BulkTelemetryCreateView(APIView):
    """
    POST /api/telemetry/bulk/
    Ingest multiple telemetry records at once.
    """

    def post(self, request):
        serializer = BulkTelemetrySerializer(data=request.data)
        if serializer.is_valid():
            result = serializer.save()
            return Response(
                {
                    "status": "success",
                    "created_count": len(result["created"]),
                    "failed_count": len(result["errors"]),
                    "created": result["created"],
                    "errors": result["errors"],
                },
                status=status.HTTP_201_CREATED,
            )
        return Response(
            {"status": "error", "errors": serializer.errors},
            status=status.HTTP_400_BAD_REQUEST,
        )


class ParkingLogCreateView(APIView):
    """
    POST /api/parking-log/
    Record a parking slot occupancy event.
    """

    def post(self, request):
        serializer = ParkingLogSerializer(data=request.data)
        if serializer.is_valid():
            log = serializer.save()
            return Response(
                {
                    "status": "success",
                    "message": "Parking log recorded.",
                    "device_code": log.device.device_code,
                    "is_occupied": log.is_occupied,
                    "timestamp": log.timestamp,
                },
                status=status.HTTP_201_CREATED,
            )
        return Response(
            {"status": "error", "errors": serializer.errors},
            status=status.HTTP_400_BAD_REQUEST,
        )


class ParkingLogListView(APIView):
    """
    GET /api/parking-logs/
    List parking logs with optional zone and date filters.
    """

    def get(self, request):
        logs = ParkingLog.objects.select_related(
            "device", "device__slot", "device__slot__zone"
        ).all()

        # Filter by zone
        zone_id = request.query_params.get("zone")
        if zone_id:
            logs = logs.filter(device__slot__zone_id=zone_id)

        # Filter by date
        date = request.query_params.get("date")
        if date:
            logs = logs.filter(timestamp__date=date)

        logs = logs[:200]  # Limit results
        serializer = ParkingLogListSerializer(logs, many=True)
        return Response(serializer.data)


class AlertListView(APIView):
    """
    GET /api/alerts/
    List alerts with optional filters: severity, alert_type, is_acknowledged.
    """

    def get(self, request):
        alerts = Alert.objects.select_related("device", "zone").all()

        severity = request.query_params.get("severity")
        if severity:
            alerts = alerts.filter(severity=severity.upper())

        alert_type = request.query_params.get("type")
        if alert_type:
            alerts = alerts.filter(alert_type=alert_type.upper())

        acknowledged = request.query_params.get("acknowledged")
        if acknowledged is not None:
            alerts = alerts.filter(is_acknowledged=acknowledged.lower() == "true")

        alerts = alerts[:200]
        serializer = AlertSerializer(alerts, many=True)
        return Response(serializer.data)


class AlertAcknowledgeView(APIView):
    """
    PATCH /api/alerts/<id>/acknowledge/
    Mark a single alert as acknowledged.
    """

    def patch(self, request, pk):
        try:
            alert = Alert.objects.get(pk=pk)
        except Alert.DoesNotExist:
            return Response(
                {"status": "error", "message": "Alert not found."},
                status=status.HTTP_404_NOT_FOUND,
            )

        if alert.is_acknowledged:
            return Response(
                {"status": "info", "message": "Alert already acknowledged."},
                status=status.HTTP_200_OK,
            )

        from django.utils import timezone as tz

        alert.is_acknowledged = True
        alert.acknowledged_at = tz.now()
        alert.save(update_fields=["is_acknowledged", "acknowledged_at"])

        return Response(
            {
                "status": "success",
                "message": "Alert acknowledged.",
                "alert_id": alert.id,
                "acknowledged_at": alert.acknowledged_at,
            }
        )


class FacilityListView(APIView):
    """GET /api/facilities/ — List parking facilities."""

    def get(self, request):
        facilities = ParkingFacility.objects.prefetch_related("zones").all()
        serializer = FacilitySerializer(facilities, many=True)
        return Response(serializer.data)


class ZoneListView(APIView):
    """GET /api/zones/ — List zones with optional facility filter."""

    def get(self, request):
        zones = (
            ParkingZone.objects.select_related("facility")
            .prefetch_related("slots", "slots__device", "slots__device__parking_logs")
            .all()
        )

        facility_id = request.query_params.get("facility")
        if facility_id:
            zones = zones.filter(facility_id=facility_id)

        serializer = ZoneSerializer(zones, many=True)
        return Response(serializer.data)


class DeviceListView(APIView):
    """GET /api/devices/ — List devices with optional zone, active, and search filters."""

    def get(self, request):
        devices = Device.objects.select_related(
            "slot", "slot__zone", "slot__zone__facility"
        ).all()

        zone_id = request.query_params.get("zone")
        if zone_id:
            devices = devices.filter(slot__zone_id=zone_id)

        active = request.query_params.get("active")
        if active is not None:
            devices = devices.filter(is_active=active.lower() == "true")

        search = request.query_params.get("search")
        if search:
            devices = devices.filter(device_code__icontains=search)

        serializer = DeviceSerializer(devices, many=True)
        return Response(serializer.data)


class DashboardSummaryView(APIView):
    """
    GET /api/dashboard/summary/?date=YYYY-MM-DD
    Returns an aggregate dashboard overview for a specific date.

    PRD Requirements:
    - Total parking events
    - Current occupancy count
    - Number of active devices
    - Number of alerts triggered
    - Basic efficiency indicators
    """

    def get(self, request):
        from django.db.models import Avg, Count, Q, Sum
        import datetime

        # Parse date parameter (defaults to today)
        date_str = request.query_params.get("date")
        if date_str:
            try:
                target_date = datetime.date.fromisoformat(date_str)
            except ValueError:
                return Response(
                    {"error": "Invalid date format. Use YYYY-MM-DD."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
        else:
            target_date = datetime.date.today()

        # Global counts
        total_slots = ParkingSlot.objects.filter(is_active=True).count()
        total_devices = Device.objects.filter(is_active=True).count()
        avg_health = (
            Device.objects.filter(is_active=True).aggregate(avg=Avg("health_score"))[
                "avg"
            ]
            or 0
        )

        # ── Total parking events for the date (PRD requirement) ──
        total_parking_events = ParkingLog.objects.filter(
            timestamp__date=target_date
        ).count()

        # ── Alerts triggered on the date (PRD requirement) ──
        alerts_triggered_on_date = Alert.objects.filter(
            created_at__date=target_date
        ).count()

        # Alert counts (open alerts)
        open_alerts = Alert.objects.filter(is_acknowledged=False)
        alert_summary = {
            "total": open_alerts.count(),
            "critical": open_alerts.filter(severity="CRITICAL").count(),
            "warning": open_alerts.filter(severity="WARNING").count(),
            "info": open_alerts.filter(severity="INFO").count(),
            "triggered_on_date": alerts_triggered_on_date,
        }

        # ── Efficiency Indicators (PRD requirement) ──
        # Get targets for the date
        targets = ParkingTarget.objects.filter(date=target_date).select_related("zone")
        total_target_usage = 0
        total_actual_usage = 0

        for target in targets:
            actual_usage = ParkingLog.objects.filter(
                device__slot__zone=target.zone,
                timestamp__date=target_date,
                is_occupied=True,
            ).count()
            total_target_usage += target.target_occupancy_count
            total_actual_usage += actual_usage

        overall_efficiency = 0.0
        if total_target_usage > 0:
            overall_efficiency = round(
                (total_actual_usage / total_target_usage) * 100, 1
            )

        efficiency_summary = {
            "target_usage": total_target_usage,
            "actual_usage": total_actual_usage,
            "efficiency_percentage": overall_efficiency,
        }

        # Zone breakdown
        zones = (
            ParkingZone.objects.select_related("facility")
            .prefetch_related("slots", "slots__device", "slots__device__parking_logs")
            .filter(is_active=True)
        )

        zone_data = []
        total_occupied = 0
        for zone in zones:
            occupied = 0
            for slot in zone.slots.filter(is_active=True).select_related("device"):
                device = getattr(slot, "device", None)
                if device:
                    last_log = device.parking_logs.first()
                    if last_log and last_log.is_occupied:
                        occupied += 1
            total_occupied += occupied

            # Get zone-specific efficiency for the date
            zone_target = targets.filter(zone=zone).first()
            zone_actual = ParkingLog.objects.filter(
                device__slot__zone=zone,
                timestamp__date=target_date,
                is_occupied=True,
            ).count()
            zone_efficiency = 0.0
            if zone_target and zone_target.target_occupancy_count > 0:
                zone_efficiency = round(
                    (zone_actual / zone_target.target_occupancy_count) * 100, 1
                )

            zone_data.append(
                {
                    "id": zone.id,
                    "name": zone.name,
                    "zone_type": zone.zone_type,
                    "total_slots": zone.total_slots,
                    "occupied": occupied,
                    "available": zone.total_slots - occupied,
                    "occupancy_rate": round((occupied / zone.total_slots) * 100, 1)
                    if zone.total_slots > 0
                    else 0,
                    "target_usage": zone_target.target_occupancy_count
                    if zone_target
                    else 0,
                    "actual_usage": zone_actual,
                    "efficiency_percentage": zone_efficiency,
                }
            )

        return Response(
            {
                "date": str(target_date),
                "total_slots": total_slots,
                "total_occupied": total_occupied,
                "total_available": total_slots - total_occupied,
                "occupancy_rate": round((total_occupied / total_slots) * 100, 1)
                if total_slots > 0
                else 0,
                "total_parking_events": total_parking_events,  # PRD requirement
                "active_devices": total_devices,
                "avg_health_score": round(avg_health, 1),
                "alerts": alert_summary,
                "efficiency": efficiency_summary,  # PRD requirement
                "zones": zone_data,
            }
        )


class DashboardHourlyView(APIView):
    """
    GET /api/dashboard/hourly/?zone=5&date=2026-02-17
    Returns hourly parking usage for a given zone and date.
    """

    def get(self, request):
        from django.db.models.functions import ExtractHour
        from django.db.models import Count
        import datetime

        zone_id = request.query_params.get("zone")
        date_str = request.query_params.get("date")

        if not date_str:
            date_str = str(datetime.date.today())

        try:
            target_date = datetime.date.fromisoformat(date_str)
        except ValueError:
            return Response(
                {"error": "Invalid date format. Use YYYY-MM-DD."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        logs = ParkingLog.objects.filter(timestamp__date=target_date)
        if zone_id:
            logs = logs.filter(device__slot__zone_id=zone_id)

        hourly = (
            logs.filter(is_occupied=True)
            .annotate(hour=ExtractHour("timestamp"))
            .values("hour")
            .annotate(count=Count("id"))
            .order_by("hour")
        )

        # --- Last week's hourly data (same day of week, 7 days ago) ---
        last_week_date = target_date - datetime.timedelta(days=7)
        last_week_logs = ParkingLog.objects.filter(timestamp__date=last_week_date)
        if zone_id:
            last_week_logs = last_week_logs.filter(device__slot__zone_id=zone_id)

        last_week_hourly = (
            last_week_logs.filter(is_occupied=True)
            .annotate(hour=ExtractHour("timestamp"))
            .values("hour")
            .annotate(count=Count("id"))
            .order_by("hour")
        )
        last_week_map = {item["hour"]: item["count"] for item in last_week_hourly}

        # --- Target per hour (daily target spread evenly across 24 hours) ---
        target_filters = {"date": target_date}
        if zone_id:
            target_filters["zone_id"] = zone_id
        targets = ParkingTarget.objects.filter(**target_filters)
        total_target = sum(t.target_occupancy_count for t in targets)
        target_per_hour = round(total_target / 24, 1) if total_target > 0 else 0

        # Build full 24-hour array
        hourly_map = {item["hour"]: item["count"] for item in hourly}
        data = [
            {
                "hour": h,
                "label": f"{h:02d}:00",
                "occupied_events": hourly_map.get(h, 0),
                "target": target_per_hour,
                "last_week": last_week_map.get(h, 0),
            }
            for h in range(24)
        ]

        return Response(
            {
                "date": str(target_date),
                "zone_id": zone_id,
                "hourly": data,
            }
        )


class TargetListView(APIView):
    """
    GET /api/targets/?date=YYYY-MM-DD
    List parking targets and efficiency metrics for a specific date.
    """

    def get(self, request):
        import datetime

        date_str = request.query_params.get("date")

        if not date_str:
            date_str = str(datetime.date.today())

        try:
            target_date = datetime.date.fromisoformat(date_str)
        except ValueError:
            return Response(
                {"error": "Invalid date format. Use YYYY-MM-DD."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        targets = ParkingTarget.objects.select_related("zone").filter(date=target_date)
        serializer = ParkingTargetSerializer(targets, many=True)
        return Response(serializer.data)
