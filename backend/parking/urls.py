from django.urls import path

from . import views

urlpatterns = [
    path('telemetry/', views.TelemetryCreateView.as_view(), name='telemetry-create'),
    path('telemetry/bulk/', views.BulkTelemetryCreateView.as_view(), name='telemetry-bulk'),
    path('parking-log/', views.ParkingLogCreateView.as_view(), name='parking-log-create'),
    path('parking-logs/', views.ParkingLogListView.as_view(), name='parking-log-list'),
    path('alerts/', views.AlertListView.as_view(), name='alert-list'),
    path('alerts/<int:pk>/acknowledge/', views.AlertAcknowledgeView.as_view(), name='alert-acknowledge'),
    path('facilities/', views.FacilityListView.as_view(), name='facility-list'),
    path('zones/', views.ZoneListView.as_view(), name='zone-list'),
    path('devices/', views.DeviceListView.as_view(), name='device-list'),
    path('dashboard/summary/', views.DashboardSummaryView.as_view(), name='dashboard-summary'),
    path('dashboard/hourly/', views.DashboardHourlyView.as_view(), name='dashboard-hourly'),
]
