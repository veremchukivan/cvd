from rest_framework import serializers
from .models import Location, DataPoint

class DataPointSerializer(serializers.ModelSerializer):
    location = serializers.CharField(source="location.name")

    class Meta:
        model = DataPoint
        fields = ["date", "metric", "value", "source", "location"]
