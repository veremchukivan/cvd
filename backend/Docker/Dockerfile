FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

WORKDIR /app

RUN apt-get update \
    && apt-get install -y --no-install-recommends build-essential libpq-dev \
    && rm -rf /var/lib/apt/lists/*

COPY backend/requirements.txt /app/requirements.txt

RUN pip install --upgrade pip \
    && pip install --no-cache-dir -r /app/requirements.txt

COPY backend /app/backend
COPY scripts /app/scripts

RUN chmod +x /app/backend/Docker/entrypoint.sh

WORKDIR /app/backend

ENTRYPOINT ["/app/backend/Docker/entrypoint.sh"]
CMD ["python", "manage.py", "runserver", "0.0.0.0:8000"]
