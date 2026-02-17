from django.urls import path

from . import views

urlpatterns = [
    path('telemetry/', views.TelemetryCreateView.as_view(), name='telemetry-create'),
    path('telemetry/bulk/', views.BulkTelemetryCreateView.as_view(), name='telemetry-bulk'),
    path('parking-log/', views.ParkingLogCreateView.as_view(), name='parking-log-create'),
    path('parking-logs/', views.ParkingLogListView.as_view(), name='parking-log-list'),
]
