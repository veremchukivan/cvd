from django.http import HttpResponse
from rest_framework.decorators import api_view
from rest_framework.response import Response
from .models import DataPoint
from .serializers import DataPointSerializer
from .services.analytics import ChartGenerationError, build_metric_chart_png

@api_view(["GET"])
def timeseries(request):
    location = request.GET.get("location")
    metric = request.GET.get("metric", "confirmed")
    source = request.GET.get("source")

    qs = DataPoint.objects.select_related("location").all()
    if location:
        qs = qs.filter(location__name__icontains=location)
    if metric:
        qs = qs.filter(metric=metric)
    if source:
        qs = qs.filter(source=source)

    data = DataPointSerializer(qs, many=True).data
    return Response(data)


@api_view(["GET"])
def country_chart(request):
    iso_code = request.GET.get("iso")
    metric = request.GET.get("metric", "cases")

    if not iso_code:
        return Response({"detail": "Query parameter 'iso' is required."}, status=400)

    try:
        png_bytes = build_metric_chart_png(iso_code, metric)
    except ChartGenerationError as exc:
        return Response({"detail": str(exc)}, status=404)

    return HttpResponse(png_bytes, content_type="image/png")
