import random
from datetime import timedelta

from django.core.management.base import BaseCommand
from django.utils import timezone

from parking.models import (
    ParkingFacility, ParkingZone, ParkingSlot,
    Device, TelemetryData, ParkingLog,
    Alert, ParkingTarget,
)


class Command(BaseCommand):
    help = 'Seed the database with realistic sample parking data'

    def handle(self, *args, **options):
        self.stdout.write('Clearing existing data...')
        TelemetryData.objects.all().delete()
        ParkingLog.objects.all().delete()
        Alert.objects.all().delete()
        ParkingTarget.objects.all().delete()
        Device.objects.all().delete()
        ParkingSlot.objects.all().delete()
        ParkingZone.objects.all().delete()
        ParkingFacility.objects.all().delete()

        # ── 1. Facility ───────────────────────────────────────
        facility = ParkingFacility.objects.create(
            name='City Center Mall Parking',
            address='123 Main Street, Downtown'
        )
        self.stdout.write(f'  Created facility: {facility.name}')

        # ── 2. Zones ──────────────────────────────────────────
        zones_config = [
            {'name': 'Basement-1', 'zone_type': 'BASEMENT', 'total_slots': 20, 'prefix': 'B1'},
            {'name': 'Basement-2', 'zone_type': 'BASEMENT', 'total_slots': 15, 'prefix': 'B2'},
            {'name': 'Outdoor',    'zone_type': 'OUTDOOR',  'total_slots': 10, 'prefix': 'OUT'},
            {'name': 'VIP',        'zone_type': 'VIP',      'total_slots': 5,  'prefix': 'VIP'},
        ]

        zones = []
        for zc in zones_config:
            zone = ParkingZone.objects.create(
                facility=facility,
                name=zc['name'],
                zone_type=zc['zone_type'],
                total_slots=zc['total_slots'],
            )
            zones.append({'zone': zone, **zc})
            self.stdout.write(f'  Created zone: {zone.name} ({zc["total_slots"]} slots)')

        # ── 3. Slots + Devices ─────────────────────────────────
        all_devices = []
        for zc in zones:
            zone = zc['zone']
            for i in range(1, zc['total_slots'] + 1):
                slot = ParkingSlot.objects.create(
                    zone=zone,
                    slot_number=f'S{i:03d}',
                )
                device = Device.objects.create(
                    slot=slot,
                    device_code=f'PARK-{zc["prefix"]}-S{i:03d}',
                    is_active=True,
                    last_seen_at=timezone.now(),
                )
                all_devices.append(device)

        self.stdout.write(f'  Created {len(all_devices)} slots + devices')

        # ── 4. Telemetry Data (last 24h, every 5 min) ─────────
        now = timezone.now()
        telemetry_records = []
        intervals = 288  # 24h × 12 (every 5 min)

        for device in all_devices:
            for i in range(intervals):
                ts = now - timedelta(minutes=5 * i)
                voltage = round(random.uniform(210, 240), 1)
                current = round(random.uniform(3.0, 7.0), 1)
                pf = round(random.uniform(0.85, 0.98), 2)
                power = round(voltage * current * pf, 2)

                telemetry_records.append(TelemetryData(
                    device=device,
                    voltage=voltage,
                    current=current,
                    power_factor=pf,
                    power_consumption=power,
                    timestamp=ts,
                ))

        # Bulk create in batches to avoid memory issues
        batch_size = 1000
        for i in range(0, len(telemetry_records), batch_size):
            TelemetryData.objects.bulk_create(
                telemetry_records[i:i + batch_size],
                ignore_conflicts=True
            )

        self.stdout.write(f'  Created {len(telemetry_records)} telemetry records')

        # ── 5. Parking Logs (last 24h, random occupancy) ──────
        parking_logs = []
        for device in all_devices:
            occupied = False
            for i in range(random.randint(3, 12)):
                ts = now - timedelta(hours=random.uniform(0, 24))
                occupied = not occupied
                parking_logs.append(ParkingLog(
                    device=device,
                    is_occupied=occupied,
                    timestamp=ts,
                ))

        ParkingLog.objects.bulk_create(parking_logs)
        self.stdout.write(f'  Created {len(parking_logs)} parking logs')

        # ── 6. Daily Targets ──────────────────────────────────
        today = now.date()
        yesterday = today - timedelta(days=1)

        for zc in zones:
            zone = zc['zone']
            for d in [yesterday, today]:
                ParkingTarget.objects.create(
                    zone=zone,
                    date=d,
                    target_occupancy_count=int(zc['total_slots'] * 0.8),
                    target_usage_hours=int(zc['total_slots'] * 10),
                )

        self.stdout.write('  Created daily targets for all zones')

        # ── 7. Sample Alerts ──────────────────────────────────
        # Pick a few devices for alerts
        offline_device = all_devices[2]
        offline_device.last_seen_at = now - timedelta(minutes=10)
        offline_device.health_score = 40
        offline_device.save()

        Alert.objects.create(
            device=offline_device,
            zone=offline_device.slot.zone,
            alert_type='DEVICE_OFFLINE',
            severity='CRITICAL',
            message=f'Device {offline_device.device_code} has not sent data for over 10 minutes',
        )

        high_power_device = all_devices[5]
        Alert.objects.create(
            device=high_power_device,
            zone=high_power_device.slot.zone,
            alert_type='HIGH_POWER',
            severity='WARNING',
            message=f'Device {high_power_device.device_code} reported power consumption of 1650W',
        )

        invalid_device = all_devices[8]
        Alert.objects.create(
            device=invalid_device,
            zone=invalid_device.slot.zone,
            alert_type='INVALID_DATA',
            severity='WARNING',
            message=f'Device {invalid_device.device_code} reported voltage of 50V (below 100V threshold)',
        )

        low_health_device = all_devices[15]
        low_health_device.health_score = 25
        low_health_device.save()
        Alert.objects.create(
            device=low_health_device,
            zone=low_health_device.slot.zone,
            alert_type='LOW_HEALTH',
            severity='INFO',
            message=f'Device {low_health_device.device_code} health score dropped to 25',
        )

        # One acknowledged alert
        Alert.objects.create(
            device=all_devices[20],
            zone=all_devices[20].slot.zone,
            alert_type='DEVICE_OFFLINE',
            severity='CRITICAL',
            message=f'Device {all_devices[20].device_code} was offline (resolved)',
            is_acknowledged=True,
            acknowledged_at=now - timedelta(hours=2),
        )

        self.stdout.write('  Created 5 sample alerts')

        # ── Summary ───────────────────────────────────────────
        self.stdout.write(self.style.SUCCESS(
            f'\n✅ Seed complete!\n'
            f'   Facility: 1\n'
            f'   Zones: {len(zones)}\n'
            f'   Slots/Devices: {len(all_devices)}\n'
            f'   Telemetry records: {len(telemetry_records)}\n'
            f'   Parking logs: {len(parking_logs)}\n'
            f'   Alerts: 5\n'
        ))
