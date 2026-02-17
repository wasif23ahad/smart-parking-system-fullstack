"""
Data Models for Smart Car Parking Monitoring & Alert System.

Commit B2: Core models — ParkingFacility, ParkingZone, ParkingSlot.

Assumptions & Thresholds (will be expanded in later commits):
─────────────────────────────────────────────────────────────
• power_consumption = voltage × current × power_factor (computed on save)
• High power threshold: > 1500W → WARNING alert
• Device offline: no telemetry for > 2 minutes → CRITICAL alert
• Invalid data: voltage outside 100–300V, or power_factor outside 0.0–1.0
• Device health score: 0–100 (see services.py for formula)
"""
from django.db import models


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
