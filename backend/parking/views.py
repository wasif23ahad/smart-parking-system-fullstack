from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView

from .serializers import (
    TelemetrySerializer, BulkTelemetrySerializer,
    ParkingLogSerializer, ParkingLogListSerializer,
)
from .models import ParkingLog


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
