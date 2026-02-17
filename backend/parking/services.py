from datetime import timedelta

from django.db.models import Avg, Count
from django.utils import timezone

from .models import Alert, Device, TelemetryData

# ── Thresholds ────────────────────────────────────────
OFFLINE_TIMEOUT_MINUTES = 2
HIGH_POWER_THRESHOLD_WATTS = 1500
MIN_VOLTAGE_THRESHOLD = 100
MAX_VOLTAGE_THRESHOLD = 300
LOW_HEALTH_THRESHOLD = 30

# ── Health scoring weights ─────────────────────────────
HEALTH_WEIGHT_RECENCY = 0.40
HEALTH_WEIGHT_VOLTAGE = 0.20
HEALTH_WEIGHT_POWER = 0.20
HEALTH_WEIGHT_ALERTS = 0.20


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


def compute_device_health(device):
    """
    Compute a 0–100 health score for a device based on:
      - Recency of last data (40%): full marks if seen < 5 min ago, 0 if > 60 min
      - Voltage stability (20%): based on avg voltage in last hour
      - Power normality (20%): based on avg power in last hour
      - Open alerts (20%): 100 if 0 alerts, decreases with more alerts

    Updates device.health_score in the database.
    Returns the computed score.
    """
    now = timezone.now()
    one_hour_ago = now - timedelta(hours=1)

    # ── Factor 1: Recency (40%) ──────────────────────
    recency_score = 0
    if device.last_seen_at:
        minutes_since = (now - device.last_seen_at).total_seconds() / 60
        if minutes_since <= OFFLINE_TIMEOUT_MINUTES:
            recency_score = 100
        elif minutes_since <= 60:
            # Linear decay from 100 to 0 over 5–60 minutes
            recency_score = max(0, 100 - (minutes_since - OFFLINE_TIMEOUT_MINUTES) * (100 / 55))
        # else: 0

    # ── Factor 2: Voltage stability (20%) ─────────────
    recent_telemetry = TelemetryData.objects.filter(
        device=device, timestamp__gte=one_hour_ago
    )
    stats = recent_telemetry.aggregate(avg_voltage=Avg('voltage'), avg_power=Avg('power_consumption'))

    voltage_score = 100
    avg_v = stats.get('avg_voltage')
    if avg_v is not None:
        # Ideal range: 200–250V
        if 200 <= avg_v <= 250:
            voltage_score = 100
        elif 150 <= avg_v < 200 or 250 < avg_v <= 300:
            voltage_score = 60
        else:
            voltage_score = 20

    # ── Factor 3: Power normality (20%) ───────────────
    power_score = 100
    avg_p = stats.get('avg_power')
    if avg_p is not None:
        if avg_p <= HIGH_POWER_THRESHOLD_WATTS:
            power_score = 100
        elif avg_p <= HIGH_POWER_THRESHOLD_WATTS * 1.5:
            power_score = 50
        else:
            power_score = 10

    # ── Factor 4: Open alerts (20%) ───────────────────
    open_alert_count = Alert.objects.filter(
        device=device, is_acknowledged=False
    ).count()
    if open_alert_count == 0:
        alert_score = 100
    elif open_alert_count <= 2:
        alert_score = 60
    else:
        alert_score = 20

    # ── Weighted total ────────────────────────────────
    score = int(
        recency_score * HEALTH_WEIGHT_RECENCY
        + voltage_score * HEALTH_WEIGHT_VOLTAGE
        + power_score * HEALTH_WEIGHT_POWER
        + alert_score * HEALTH_WEIGHT_ALERTS
    )
    score = max(0, min(100, score))

    device.health_score = score
    device.save(update_fields=['health_score'])

    return score
