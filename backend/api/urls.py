from django.urls import path
from . import views

urlpatterns = [
    path("timeseries/", views.timeseries),
    path("summary/", views.summary),
    path("map/", views.map_summary),
    path("country/<str:iso>/", views.country_details),
    path("charts/country/", views.country_chart),
    path("sync/status/", views.sync_status),
    path("sync/status/states/", views.sync_status_states),
    path("sync/status/provinces/", views.sync_status_provinces),
    path("states/summary/", views.states_summary),
    path("provinces/summary/", views.provinces_summary),
]
