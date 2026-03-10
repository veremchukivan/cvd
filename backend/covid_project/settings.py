import os
import sys
from pathlib import Path
from urllib.parse import urlparse

from celery.schedules import crontab
from dotenv import load_dotenv

load_dotenv()


def _env_int(name: str, default: int) -> int:
    try:
        return int(os.getenv(name, str(default)))
    except (TypeError, ValueError):
        return default


RUNNING_TESTS = "test" in sys.argv

BASE_DIR = Path(__file__).resolve().parent.parent

SECRET_KEY = os.getenv("SECRET_KEY", "devsecret")
DEBUG = os.getenv("DEBUG", "False") == "True"
ALLOWED_HOSTS = os.getenv("ALLOWED_HOSTS", "*").split(",")

INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    "rest_framework",
    "corsheaders",
    "api",
]

MIDDLEWARE = [
    "corsheaders.middleware.CorsMiddleware",
    "django.middleware.security.SecurityMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF = "covid_project.urls"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.debug",
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

WSGI_APPLICATION = "covid_project.wsgi.application"

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://postgres:pass@localhost:5432/covid")
parsed_db = urlparse(DATABASE_URL)

DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.postgresql",
        "NAME": parsed_db.path.lstrip("/") or "covid",
        "USER": parsed_db.username or "postgres",
        "PASSWORD": parsed_db.password or "pass",
        "HOST": parsed_db.hostname or "localhost",
        "PORT": str(parsed_db.port or 5432),
    }
}

LANGUAGE_CODE = "en-us"
TIME_ZONE = "UTC"
USE_I18N = True
USE_TZ = True

STATIC_URL = "static/"

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

REST_FRAMEWORK = {
    "DEFAULT_RENDERER_CLASSES": ["rest_framework.renderers.JSONRenderer"]
}

# Allow local frontend (webpack dev server) to call the API
CORS_ALLOWED_ORIGINS = os.getenv("CORS_ALLOWED_ORIGINS", "http://localhost:3000").split(",")

# API summary/map cache
CACHE_URL = "" if RUNNING_TESTS else os.getenv("CACHE_URL", os.getenv("REDIS_URL", "")).strip()
if CACHE_URL:
    CACHES = {
        "default": {
            "BACKEND": "django.core.cache.backends.redis.RedisCache",
            "LOCATION": CACHE_URL,
        }
    }
else:
    CACHES = {
        "default": {
            "BACKEND": "django.core.cache.backends.locmem.LocMemCache",
            "LOCATION": "covid-local-cache",
        }
    }

SUMMARY_CACHE_TTL_SECONDS = _env_int("SUMMARY_CACHE_TTL_SECONDS", 0 if RUNNING_TESTS else 300)
SUMMARY_CACHE_KEY_PREFIX = os.getenv("SUMMARY_CACHE_KEY_PREFIX", "covid:summary:v1")
SUMMARY_PRECOMPUTE_METRICS = tuple(
    item.strip().lower()
    for item in os.getenv(
        "SUMMARY_PRECOMPUTE_METRICS",
        "cases,deaths,mortality,active,vaccinations_total",
    ).split(",")
    if item.strip()
)
SUMMARY_PRECOMPUTE_GROUP_BY = tuple(
    item.strip().lower()
    for item in os.getenv("SUMMARY_PRECOMPUTE_GROUP_BY", "country,continent").split(",")
    if item.strip()
)
SUMMARY_PRECOMPUTE_RANGE_DAYS = max(_env_int("SUMMARY_PRECOMPUTE_RANGE_DAYS", 30), 1)

# Celery / task scheduling
CELERY_BROKER_URL = os.getenv("CELERY_BROKER_URL", os.getenv("REDIS_URL", "redis://localhost:6379/0"))
CELERY_RESULT_BACKEND = os.getenv("CELERY_RESULT_BACKEND", CELERY_BROKER_URL)
CELERY_TIMEZONE = TIME_ZONE
CELERY_BEAT_SCHEDULE = {
    "ingest-disease-latest-every-12h": {
        "task": "api.tasks.ingest_disease_latest",
        "schedule": crontab(minute=0, hour="*/12"),
    },
    "ingest-disease-states-every-12h": {
        "task": "api.tasks.ingest_disease_states",
        "schedule": crontab(minute=10, hour="*/12"),
    },
    "ingest-disease-provinces-every-12h": {
        "task": "api.tasks.ingest_disease_provinces",
        "schedule": crontab(minute=20, hour="*/12"),
        "kwargs": {"lastdays": "30"},
    },
    "ingest-disease-historical-daily": {
        "task": "api.tasks.ingest_disease_historical",
        "schedule": crontab(minute=30, hour=3),
        "kwargs": {"lastdays": "30"},
    },
    "ingest-disease-full-sync-weekly": {
        "task": "api.tasks.ingest_disease",
        "schedule": crontab(minute=45, hour=4, day_of_week="sun"),
        "kwargs": {"lastdays": "all", "province_lastdays": "all"},
    },
    "precompute-summary-cache-hourly": {
        "task": "api.tasks.precompute_summary_cache",
        "schedule": crontab(minute=5, hour="*"),
    },
}
