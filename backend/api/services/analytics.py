import io
import matplotlib
import matplotlib.pyplot as plt
import pandas as pd

from django.db.models import QuerySet

from api.models import DataPoint

matplotlib.use("Agg")


class ChartGenerationError(Exception):
    """Raised when a chart cannot be generated for provided parameters."""


def _fetch_timeseries(iso_code: str, metric: str) -> QuerySet[DataPoint]:
    return (
        DataPoint.objects.filter(
            location__iso_code__iexact=iso_code,
            metric=metric,
        )
        .select_related("location")
        .order_by("date")
    )


def build_metric_chart_png(iso_code: str, metric: str = "cases") -> bytes:
    qs = _fetch_timeseries(iso_code, metric)
    if not qs.exists():
        raise ChartGenerationError("No data found for the specified ISO code and metric.")

    df = pd.DataFrame.from_records(qs.values("date", "value"))
    df["date"] = pd.to_datetime(df["date"])
    df = df.sort_values("date")

    fig, ax = plt.subplots(figsize=(8, 4))
    ax.plot(df["date"], df["value"], label=metric.capitalize(), color="#1f77b4")
    ax.set_title(f"{metric.capitalize()} over time for {qs.first().location.name}")
    ax.set_xlabel("Date")
    ax.set_ylabel(metric.capitalize())
    ax.grid(True, which="major", linestyle="--", alpha=0.4)
    ax.legend()
    fig.autofmt_xdate()

    buffer = io.BytesIO()
    plt.tight_layout()
    fig.savefig(buffer, format="png")
    plt.close(fig)

    return buffer.getvalue()
