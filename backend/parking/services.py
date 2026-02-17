from datetime import timedelta

from django.utils import timezone

from .models import Alert, Device, TelemetryData

# ── Thresholds ────────────────────────────────────────
OFFLINE_TIMEOUT_MINUTES = 5
HIGH_POWER_THRESHOLD_WATTS = 1500
MIN_VOLTAGE_THRESHOLD = 100
MAX_VOLTAGE_THRESHOLD = 300
LOW_HEALTH_THRESHOLD = 30


def _create_alert_if_new(device, zone, alert_type, severity, message):
    """
    Create an alert only if there is no existing unacknowledged alert
    of the same type for the same device (dedup).
    """
    exists = Alert.objects.filter(
        device=device,
        alert_type=alert_type,
        is_acknowledged=False,
    ).exists()

    if not exists:
        Alert.objects.create(
            device=device,
            zone=zone,
            alert_type=alert_type,
            severity=severity,
            message=message,
        )
        return True
    return False


def detect_offline_devices():
    """
    Flag devices that have not sent data within OFFLINE_TIMEOUT_MINUTES.
    Only active devices are checked.
    """
    cutoff = timezone.now() - timedelta(minutes=OFFLINE_TIMEOUT_MINUTES)
    offline_devices = Device.objects.filter(
        is_active=True,
        last_seen_at__lt=cutoff,
    ).select_related('slot__zone')

    created_count = 0
    for device in offline_devices:
        zone = device.slot.zone
        created = _create_alert_if_new(
            device=device,
            zone=zone,
            alert_type='DEVICE_OFFLINE',
            severity='CRITICAL',
            message=(
                f'Device {device.device_code} has not sent data '
                f'for over {OFFLINE_TIMEOUT_MINUTES} minutes.'
            ),
        )
        if created:
            created_count += 1

    return created_count


def detect_high_power(telemetry):
    """
    Check if a single telemetry record exceeds the power threshold.
    Called inline after telemetry ingestion.
    """
    if telemetry.power_consumption > HIGH_POWER_THRESHOLD_WATTS:
        device = telemetry.device
        zone = device.slot.zone
        return _create_alert_if_new(
            device=device,
            zone=zone,
            alert_type='HIGH_POWER',
            severity='WARNING',
            message=(
                f'Device {device.device_code} reported power consumption '
                f'of {telemetry.power_consumption}W '
                f'(threshold: {HIGH_POWER_THRESHOLD_WATTS}W).'
            ),
        )
    return False


def detect_invalid_data(telemetry):
    """
    Check if telemetry voltage is outside the valid range.
    Called inline after telemetry ingestion.
    """
    v = telemetry.voltage
    if v < MIN_VOLTAGE_THRESHOLD or v > MAX_VOLTAGE_THRESHOLD:
        device = telemetry.device
        zone = device.slot.zone
        return _create_alert_if_new(
            device=device,
            zone=zone,
            alert_type='INVALID_DATA',
            severity='WARNING',
            message=(
                f'Device {device.device_code} reported voltage of {v}V '
                f'(valid range: {MIN_VOLTAGE_THRESHOLD}–{MAX_VOLTAGE_THRESHOLD}V).'
            ),
        )
    return False


def detect_low_health(device):
    """
    Check if device health score is below the threshold.
    """
    if device.health_score < LOW_HEALTH_THRESHOLD:
        zone = device.slot.zone
        return _create_alert_if_new(
            device=device,
            zone=zone,
            alert_type='LOW_HEALTH',
            severity='INFO',
            message=(
                f'Device {device.device_code} health score '
                f'dropped to {device.health_score} '
                f'(threshold: {LOW_HEALTH_THRESHOLD}).'
            ),
        )
    return False


def run_all_detections(telemetry):
    """
    Run all inline alert detections after a telemetry record is saved.
    Returns a list of alert types that were triggered.
    """
    triggered = []
    if detect_high_power(telemetry):
        triggered.append('HIGH_POWER')
    if detect_invalid_data(telemetry):
        triggered.append('INVALID_DATA')
    if detect_low_health(telemetry.device):
        triggered.append('LOW_HEALTH')
    return triggered
