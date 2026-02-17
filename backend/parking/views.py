from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView

from .serializers import TelemetrySerializer


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
                },
                status=status.HTTP_201_CREATED,
            )
        return Response(
            {'status': 'error', 'errors': serializer.errors},
            status=status.HTTP_400_BAD_REQUEST,
        )
