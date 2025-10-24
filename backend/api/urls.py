from django.urls import path
from . import views

urlpatterns = [
    path("timeseries/", views.timeseries),
    path("charts/country/", views.country_chart),
]
