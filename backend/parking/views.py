from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView

from .serializers import (
    TelemetrySerializer, BulkTelemetrySerializer,
    ParkingLogSerializer, ParkingLogListSerializer,
    AlertSerializer,
    FacilitySerializer, ZoneSerializer, DeviceSerializer,
)
from .models import ParkingLog, Alert, ParkingFacility, ParkingZone, Device


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
                    'status': 'success',
                    'message': 'Telemetry data recorded.',
                    'device_code': telemetry.device.device_code,
                    'power_consumption': telemetry.power_consumption,
                    'timestamp': telemetry.timestamp,
                    'alerts_triggered': getattr(telemetry, 'alerts_triggered', []),
                    'health_score': getattr(telemetry, 'health_score', None),
                },
                status=status.HTTP_201_CREATED,
            )
        return Response(
            {'status': 'error', 'errors': serializer.errors},
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
                    'status': 'success',
                    'created_count': len(result['created']),
                    'failed_count': len(result['errors']),
                    'created': result['created'],
                    'errors': result['errors'],
                },
                status=status.HTTP_201_CREATED,
            )
        return Response(
            {'status': 'error', 'errors': serializer.errors},
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
                    'status': 'success',
                    'message': 'Parking log recorded.',
                    'device_code': log.device.device_code,
                    'is_occupied': log.is_occupied,
                    'timestamp': log.timestamp,
                },
                status=status.HTTP_201_CREATED,
            )
        return Response(
            {'status': 'error', 'errors': serializer.errors},
            status=status.HTTP_400_BAD_REQUEST,
        )


class ParkingLogListView(APIView):
    """
    GET /api/parking-logs/
    List parking logs with optional zone and date filters.
    """

    def get(self, request):
        logs = ParkingLog.objects.select_related(
            'device', 'device__slot', 'device__slot__zone'
        ).all()

        # Filter by zone
        zone_id = request.query_params.get('zone')
        if zone_id:
            logs = logs.filter(device__slot__zone_id=zone_id)

        # Filter by date
        date = request.query_params.get('date')
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
        alerts = Alert.objects.select_related('device', 'zone').all()

        severity = request.query_params.get('severity')
        if severity:
            alerts = alerts.filter(severity=severity.upper())

        alert_type = request.query_params.get('type')
        if alert_type:
            alerts = alerts.filter(alert_type=alert_type.upper())

        acknowledged = request.query_params.get('acknowledged')
        if acknowledged is not None:
            alerts = alerts.filter(is_acknowledged=acknowledged.lower() == 'true')

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
                {'status': 'error', 'message': 'Alert not found.'},
                status=status.HTTP_404_NOT_FOUND,
            )

        if alert.is_acknowledged:
            return Response(
                {'status': 'info', 'message': 'Alert already acknowledged.'},
                status=status.HTTP_200_OK,
            )

        from django.utils import timezone as tz
        alert.is_acknowledged = True
        alert.acknowledged_at = tz.now()
        alert.save(update_fields=['is_acknowledged', 'acknowledged_at'])

        return Response({
            'status': 'success',
            'message': 'Alert acknowledged.',
            'alert_id': alert.id,
            'acknowledged_at': alert.acknowledged_at,
        })


class FacilityListView(APIView):
    """GET /api/facilities/ — List parking facilities."""

    def get(self, request):
        facilities = ParkingFacility.objects.prefetch_related('zones').all()
        serializer = FacilitySerializer(facilities, many=True)
        return Response(serializer.data)


class ZoneListView(APIView):
    """GET /api/zones/ — List zones with optional facility filter."""

    def get(self, request):
        zones = ParkingZone.objects.select_related('facility').prefetch_related(
            'slots', 'slots__device', 'slots__device__parking_logs'
        ).all()

        facility_id = request.query_params.get('facility')
        if facility_id:
            zones = zones.filter(facility_id=facility_id)

        serializer = ZoneSerializer(zones, many=True)
        return Response(serializer.data)


class DeviceListView(APIView):
    """GET /api/devices/ — List devices with optional zone, active, and search filters."""

    def get(self, request):
        devices = Device.objects.select_related(
            'slot', 'slot__zone', 'slot__zone__facility'
        ).all()

        zone_id = request.query_params.get('zone')
        if zone_id:
            devices = devices.filter(slot__zone_id=zone_id)

        active = request.query_params.get('active')
        if active is not None:
            devices = devices.filter(is_active=active.lower() == 'true')

        search = request.query_params.get('search')
        if search:
            devices = devices.filter(device_code__icontains=search)

        serializer = DeviceSerializer(devices, many=True)
        return Response(serializer.data)
