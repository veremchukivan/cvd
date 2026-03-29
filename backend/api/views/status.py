from rest_framework.decorators import api_view
from rest_framework.response import Response

from ..models import ProvinceDataPoint, StateDataPoint
from ..services.ingest import get_ingest_status, get_province_ingest_status, get_state_ingest_status
from .shared import _parse_date, _round

@api_view(["GET"])
def sync_status(request):
    source = request.GET.get("source", "disease.sh")
    return Response(get_ingest_status(source=source))

@api_view(["GET"])
def sync_status_states(request):
    source = request.GET.get("source", "disease.sh_states")
    return Response(get_state_ingest_status(source=source))

@api_view(["GET"])
def sync_status_provinces(request):
    source = request.GET.get("source", "disease.sh_provinces")
    return Response(get_province_ingest_status(source=source))

@api_view(["GET"])
def states_summary(request):
    metric = (request.GET.get("metric") or "cases").strip().lower()
    date_param = request.GET.get("date")
    source = request.GET.get("source", "disease.sh_states")
    requested_day = _parse_date(date_param)

    qs = StateDataPoint.objects.select_related("state").filter(metric=metric, source=source)
    if requested_day:
        qs = qs.filter(date__lte=requested_day)

    latest_per_state: dict[str, dict] = {}
    for point in qs.order_by("state__code", "date"):
        latest_per_state[point.state.code] = {
            "code": point.state.code,
            "name": point.state.name,
            "country": point.state.country_iso,
            "date": point.date.isoformat(),
            "metric": metric,
            "value": _round(point.value),
        }

    rows = sorted(latest_per_state.values(), key=lambda item: item.get("value") or 0, reverse=True)
    return Response(
        {
            "metric": metric,
            "date": requested_day.isoformat() if requested_day else date_param,
            "source": source,
            "data": rows,
        }
    )

@api_view(["GET"])
def provinces_summary(request):
    metric = (request.GET.get("metric") or "cases").strip().lower()
    date_param = request.GET.get("date")
    country_param = request.GET.get("country")
    country_iso_param = (request.GET.get("countryIso") or request.GET.get("country_iso") or "").strip()
    source = request.GET.get("source", "disease.sh_provinces")
    requested_day = _parse_date(date_param)

    qs = ProvinceDataPoint.objects.select_related("province", "province__country").filter(metric=metric, source=source)
    if country_iso_param:
        qs = qs.filter(province__country__iso_code__iexact=country_iso_param)
    if country_param:
        qs = qs.filter(province__country_name__iexact=country_param)
    if requested_day:
        qs = qs.filter(date__lte=requested_day)

    latest_per_province: dict[str, dict] = {}
    for point in qs.order_by("province__code", "date"):
        latest_per_province[point.province.code] = {
            "code": point.province.code,
            "name": point.province.name,
            "country": point.province.country_name,
            "countryIso": point.province.country.iso_code if point.province.country else None,
            "date": point.date.isoformat(),
            "metric": metric,
            "value": _round(point.value),
        }

    rows = sorted(latest_per_province.values(), key=lambda item: item.get("value") or 0, reverse=True)
    return Response(
        {
            "metric": metric,
            "date": requested_day.isoformat() if requested_day else date_param,
            "country": country_param,
            "countryIso": country_iso_param or None,
            "source": source,
            "data": rows,
        }
    )
