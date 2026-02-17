from django.db import models
from django.core.validators import MinValueValidator, MaxValueValidator


class ParkingFacility(models.Model):
    """Represents a physical parking facility / site."""
    name = models.CharField(max_length=200)
    address = models.TextField(blank=True, default='')
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name_plural = 'Parking Facilities'
        ordering = ['name']

    def __str__(self):
        return self.name


class ParkingZone(models.Model):
    """A zone within a facility (e.g., Basement-1, VIP)."""
    ZONE_TYPES = [
        ('BASEMENT', 'Basement'),
        ('OUTDOOR', 'Outdoor'),
        ('VIP', 'VIP'),
        ('ROOFTOP', 'Rooftop'),
    ]

    facility = models.ForeignKey(
        ParkingFacility, on_delete=models.CASCADE, related_name='zones'
    )
    name = models.CharField(max_length=100)
    zone_type = models.CharField(max_length=20, choices=ZONE_TYPES, default='BASEMENT')
    total_slots = models.PositiveIntegerField(default=0)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['facility', 'name']
        unique_together = ['facility', 'name']

    def __str__(self):
        return f"{self.facility.name} - {self.name}"


class ParkingSlot(models.Model):
    """An individual parking slot within a zone."""
    zone = models.ForeignKey(
        ParkingZone, on_delete=models.CASCADE, related_name='slots'
    )
    slot_number = models.CharField(max_length=20)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['zone', 'slot_number']
        unique_together = ['zone', 'slot_number']

    def __str__(self):
        return f"{self.zone.name} - Slot {self.slot_number}"


class Device(models.Model):
    """A sensor/controller device attached to a parking slot."""
    slot = models.OneToOneField(
        ParkingSlot, on_delete=models.CASCADE, related_name='device'
    )
    device_code = models.CharField(max_length=50, unique=True, db_index=True)
    is_active = models.BooleanField(default=True)
    last_seen_at = models.DateTimeField(null=True, blank=True)
    health_score = models.IntegerField(
        default=100,
        validators=[MinValueValidator(0), MaxValueValidator(100)]
    )
    installed_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['device_code']

    def __str__(self):
        return self.device_code


class TelemetryData(models.Model):
    """Time-series telemetry data received from devices."""
    device = models.ForeignKey(
        Device, on_delete=models.CASCADE, related_name='telemetry'
    )
    voltage = models.FloatField(help_text="Voltage in Volts")
    current = models.FloatField(help_text="Current in Amperes")
    power_factor = models.FloatField(help_text="Power factor (0.0 to 1.0)")
    power_consumption = models.FloatField(
        help_text="Computed: voltage × current × power_factor (Watts)",
        editable=False,
        default=0
    )
    timestamp = models.DateTimeField(db_index=True)
    received_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-timestamp']
        unique_together = ['device', 'timestamp']
        verbose_name_plural = 'Telemetry Data'

    def save(self, *args, **kwargs):
        """Compute power consumption before saving."""
        self.power_consumption = round(self.voltage * self.current * self.power_factor, 2)
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.device.device_code} @ {self.timestamp}"


class ParkingLog(models.Model):
    """Records when a parking slot becomes occupied or free."""
    device = models.ForeignKey(
        Device, on_delete=models.CASCADE, related_name='parking_logs'
    )
    is_occupied = models.BooleanField()
    timestamp = models.DateTimeField(db_index=True)
    received_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-timestamp']

    def __str__(self):
        status = "Occupied" if self.is_occupied else "Free"
        return f"{self.device.device_code} → {status} @ {self.timestamp}"


class Alert(models.Model):
    """System-generated alerts for abnormal conditions."""
    ALERT_TYPES = [
        ('DEVICE_OFFLINE', 'Device Offline'),
        ('HIGH_POWER', 'High Power Usage'),
        ('INVALID_DATA', 'Invalid Data'),
        ('LOW_HEALTH', 'Low Health Score'),
    ]
    SEVERITY_LEVELS = [
        ('INFO', 'Info'),
        ('WARNING', 'Warning'),
        ('CRITICAL', 'Critical'),
    ]

    device = models.ForeignKey(
        Device, on_delete=models.CASCADE, related_name='alerts',
        null=True, blank=True
    )
    zone = models.ForeignKey(
        ParkingZone, on_delete=models.CASCADE, related_name='alerts',
        null=True, blank=True
    )
    alert_type = models.CharField(max_length=30, choices=ALERT_TYPES)
    severity = models.CharField(max_length=10, choices=SEVERITY_LEVELS, default='WARNING')
    message = models.TextField()
    is_acknowledged = models.BooleanField(default=False)
    acknowledged_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"[{self.severity}] {self.alert_type} — {self.message[:50]}"


class ParkingTarget(models.Model):
    """Daily parking usage targets per zone for efficiency tracking."""
    zone = models.ForeignKey(
        ParkingZone, on_delete=models.CASCADE, related_name='targets'
    )
    date = models.DateField(db_index=True)
    target_occupancy_count = models.PositiveIntegerField(
        help_text="Expected number of occupied slots at any time"
    )
    target_usage_hours = models.PositiveIntegerField(
        default=0,
        help_text="Expected total usage hours for the day"
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ['zone', 'date']
        ordering = ['-date']

    def __str__(self):
        return f"{self.zone.name} target for {self.date}"


