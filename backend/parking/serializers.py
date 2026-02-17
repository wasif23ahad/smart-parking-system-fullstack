from django.utils import timezone
from rest_framework import serializers

from .models import Device, TelemetryData


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

        return telemetry
