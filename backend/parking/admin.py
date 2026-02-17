
from django.contrib import admin
from django.utils import timezone
from .models import (
    ParkingFacility, ParkingZone, ParkingSlot,
    Device, TelemetryData, ParkingLog,
    Alert, ParkingTarget,
)


@admin.register(ParkingFacility)
class ParkingFacilityAdmin(admin.ModelAdmin):
    list_display = ['name', 'address', 'is_active', 'created_at']
    list_filter = ['is_active']
    search_fields = ['name', 'address']


@admin.register(ParkingZone)
class ParkingZoneAdmin(admin.ModelAdmin):
    list_display = ['name', 'facility', 'zone_type', 'total_slots', 'is_active']
    list_filter = ['zone_type', 'is_active', 'facility']
    search_fields = ['name', 'facility__name']


@admin.register(ParkingSlot)
class ParkingSlotAdmin(admin.ModelAdmin):
    list_display = ['slot_number', 'zone', 'is_active']
    list_filter = ['is_active', 'zone__zone_type', 'zone__facility']
    search_fields = ['slot_number', 'zone__name']


@admin.register(Device)
class DeviceAdmin(admin.ModelAdmin):
    list_display = ['device_code', 'get_zone', 'is_active', 'health_score', 'last_seen_at']
    list_filter = ['is_active', 'slot__zone__zone_type', 'slot__zone__facility']
    search_fields = ['device_code', 'slot__slot_number']
    readonly_fields = ['last_seen_at', 'installed_at']

    @admin.display(description='Zone', ordering='slot__zone__name')
    def get_zone(self, obj):
        return obj.slot.zone.name


@admin.register(TelemetryData)
class TelemetryDataAdmin(admin.ModelAdmin):
    list_display = ['device', 'voltage', 'current', 'power_factor', 'power_consumption', 'timestamp']
    list_filter = ['device__slot__zone', 'timestamp']
    search_fields = ['device__device_code']
    date_hierarchy = 'timestamp'
    readonly_fields = ['power_consumption', 'received_at']


@admin.register(ParkingLog)
class ParkingLogAdmin(admin.ModelAdmin):
    list_display = ['device', 'is_occupied', 'timestamp']
    list_filter = ['is_occupied', 'device__slot__zone']
    search_fields = ['device__device_code']
    date_hierarchy = 'timestamp'


@admin.register(Alert)
class AlertAdmin(admin.ModelAdmin):
    list_display = ['alert_type', 'severity', 'device', 'zone', 'is_acknowledged', 'created_at']
    list_filter = ['severity', 'alert_type', 'is_acknowledged']
    search_fields = ['message', 'device__device_code']
    date_hierarchy = 'created_at'
    readonly_fields = ['created_at', 'acknowledged_at']
    actions = ['acknowledge_alerts']

    @admin.action(description='Mark selected alerts as acknowledged')
    def acknowledge_alerts(self, request, queryset):
        count = queryset.filter(is_acknowledged=False).update(
            is_acknowledged=True,
            acknowledged_at=timezone.now()
        )
        self.message_user(request, f'{count} alert(s) acknowledged.')


@admin.register(ParkingTarget)
class ParkingTargetAdmin(admin.ModelAdmin):
    list_display = ['zone', 'date', 'target_occupancy_count', 'target_usage_hours']
    list_filter = ['zone__facility', 'zone']
    date_hierarchy = 'date'
