from django.utils import timezone
from rest_framework import serializers

from .models import Device, TelemetryData, ParkingLog, Alert


class TelemetrySerializer(serializers.Serializer):
    """
    Validates and creates a single telemetry record.

    Validation rules:
    - device_code must exist in the database
    - timestamp must not be in the future
    - duplicate (device, timestamp) is rejected
    """
    device_code = serializers.CharField(max_length=50)
    voltage = serializers.FloatField()
    current = serializers.FloatField()
    power_factor = serializers.FloatField()
    timestamp = serializers.DateTimeField()

    def validate_device_code(self, value):
        try:
            device = Device.objects.get(device_code=value, is_active=True)
        except Device.DoesNotExist:
            raise serializers.ValidationError(
                f"Device with code '{value}' does not exist or is inactive."
            )
        self._device = device
        return value

    def validate_timestamp(self, value):
        if value > timezone.now():
            raise serializers.ValidationError('Timestamp cannot be in the future.')
        return value

    def validate(self, data):
        device = getattr(self, '_device', None)
        if device and TelemetryData.objects.filter(
            device=device, timestamp=data['timestamp']
        ).exists():
            raise serializers.ValidationError(
                'Duplicate telemetry: a record for this device and timestamp already exists.'
            )
        return data

    def create(self, validated_data):
        device = self._device
        telemetry = TelemetryData(
            device=device,
            voltage=validated_data['voltage'],
            current=validated_data['current'],
            power_factor=validated_data['power_factor'],
            timestamp=validated_data['timestamp'],
        )
        telemetry.save()  # triggers power_consumption computation

        # Update device last_seen_at
        device.last_seen_at = validated_data['timestamp']
        device.save(update_fields=['last_seen_at'])

        # Run alert detections
        from .services import run_all_detections, compute_device_health
        telemetry.alerts_triggered = run_all_detections(telemetry)

        # Update device health score
        telemetry.health_score = compute_device_health(device)

        return telemetry


class BulkTelemetrySerializer(serializers.Serializer):
    """
    Validates and creates multiple telemetry records.
    Accepts a list of telemetry payloads, validates each one,
    creates valid records, and returns a summary.
    """

    def to_internal_value(self, data):
        if not isinstance(data, list):
            raise serializers.ValidationError('Expected a list of telemetry records.')
        if len(data) == 0:
            raise serializers.ValidationError('The list cannot be empty.')
        return data

    def create(self, validated_data):
        created = []
        errors = []

        for index, record in enumerate(validated_data):
            serializer = TelemetrySerializer(data=record)
            if serializer.is_valid():
                telemetry = serializer.save()
                created.append({
                    'device_code': telemetry.device.device_code,
                    'timestamp': str(telemetry.timestamp),
                    'power_consumption': telemetry.power_consumption,
                })
            else:
                errors.append({
                    'index': index,
                    'data': record,
                    'errors': serializer.errors,
                })

        return {'created': created, 'errors': errors}


class ParkingLogSerializer(serializers.Serializer):
    """
    Validates and creates a parking occupancy event.

    Validation rules:
    - device_code must exist
    - timestamp must not be in the future
    """
    device_code = serializers.CharField(max_length=50)
    is_occupied = serializers.BooleanField()
    timestamp = serializers.DateTimeField()

    def validate_device_code(self, value):
        try:
            device = Device.objects.get(device_code=value, is_active=True)
        except Device.DoesNotExist:
            raise serializers.ValidationError(
                f"Device with code '{value}' does not exist or is inactive."
            )
        self._device = device
        return value

    def validate_timestamp(self, value):
        if value > timezone.now():
            raise serializers.ValidationError('Timestamp cannot be in the future.')
        return value

    def create(self, validated_data):
        device = self._device
        log = ParkingLog.objects.create(
            device=device,
            is_occupied=validated_data['is_occupied'],
            timestamp=validated_data['timestamp'],
        )
        return log


class ParkingLogListSerializer(serializers.ModelSerializer):
    """Read-only serializer for listing parking logs."""
    device_code = serializers.CharField(source='device.device_code', read_only=True)
    zone_name = serializers.CharField(source='device.slot.zone.name', read_only=True)

    class Meta:
        model = ParkingLog
        fields = ['id', 'device_code', 'zone_name', 'is_occupied', 'timestamp', 'received_at']


class AlertSerializer(serializers.ModelSerializer):
    """Read-only serializer for alert listing."""
    device_code = serializers.CharField(source='device.device_code', read_only=True, default=None)
    zone_name = serializers.CharField(source='zone.name', read_only=True, default=None)

    class Meta:
        model = Alert
        fields = [
            'id', 'device_code', 'zone_name', 'alert_type', 'severity',
            'message', 'is_acknowledged', 'acknowledged_at', 'created_at',
        ]

