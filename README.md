# COVID 3D Atlas

COVID 3D Atlas is a full-stack web application for analysis and visualization of COVID-19 data from open sources. The project was created as the implementation part of a bachelor thesis focused on interactive epidemiological dashboards, automated data ingestion, and modern web-based analytics.

The system combines a Django backend, PostgreSQL storage, Celery background jobs, Redis messaging/cache, and a React frontend with interactive charts and map-based views.

## Overview

The application collects COVID-19 data from public sources, normalizes and stores it in a relational database, exposes processed data through a REST API, and renders it in several analytical views.

Primary runtime data sources:

- disease.sh API for country, global, state, and province data
- Our World in Data (OWID) CSV backfill for selected historical and vaccination metrics

Main user-facing views:

- `Map` - interactive world view with metric filters and country detail panel
- `Worldwide` - global dashboard with rankings, exports, quality metadata, anomaly highlights, and simple trend outlook
- `Charts` - detailed single-country analysis with time series and custom metric combinations
- `Compare` - side-by-side comparison of two countries
- `About`, `FAQ`, `Settings` - supporting informational and preference screens

## Technology Stack

Backend:

- Python
- Django
- Django REST Framework
- PostgreSQL
- Celery
- Redis
- Pandas
- Matplotlib

Frontend:

- React
- TypeScript
- TanStack Query
- Axios
- Plotly
- react-simple-maps
- date-fns

Infrastructure:

- Docker
- Docker Compose

## Project Structure

```text
cvd/
|- backend/
|  |- api/
|  |- covid_project/
|  |- Docker/
|  |- manage.py
|  `- requirements.txt
|- frontend/
|  |- public/
|  |- src/
|  `- Docker/
`- scripts/
   |- docker-compose.yml
   `- start.sh
```

## Core Features

- Automated ingestion of latest, historical, state, and province-level COVID-19 data
- OWID backfill for selected historical and vaccination metrics
- REST API for summaries, map data, time series, exports, and country details
- Cached summary and map payloads for faster dashboard responses
- Country, continent, state, and province-level aggregation support
- CSV and JSON summary export
- Quality metadata in API responses
- Simple anomaly detection in summary payloads
- Scheduled background synchronization via Celery Beat

## API Endpoints

Base API path:

```text
http://localhost:8000/api/v1/
```

Available endpoints:

- `/timeseries/`
- `/summary/`
- `/map/`
- `/export/summary/`
- `/country/<ISO>/`
- `/charts/country/`
- `/sync/status/`
- `/sync/status/states/`
- `/sync/status/provinces/`
- `/states/summary/`
- `/provinces/summary/`

## Running the Project

### Option 1: Docker Compose

The easiest way to run the full stack is Docker Compose.

From the repository root:

```bash
docker compose -f scripts/docker-compose.yml -p cvd-hub up --build
```

If you are on a Unix-like system, you can also use:

```bash
bash scripts/start.sh
```

Default local URLs:

- Frontend: `http://localhost:3000`
- Backend API: `http://localhost:8000/api/v1`
- PostgreSQL: `localhost:5433`

Docker services defined in the project:

- `frontend`
- `backend`
- `worker`
- `beat`
- `postgres`
- `redis`

### Option 2: Local Development

Backend:

```bash
cd backend
pip install -r requirements.txt
python manage.py migrate
python manage.py runserver
```

Frontend:

```bash
cd frontend
npm install
npm start
```

For local backend development, the project uses environment variables from `backend/.env`.

Current development defaults include:

- `DATABASE_URL=postgresql://postgres:pass@localhost:5433/covid`
- `REDIS_URL=redis://localhost:6379/0`
- `CELERY_BROKER_URL=redis://localhost:6379/0`

## Background Jobs and Scheduling

The backend includes asynchronous and scheduled processing for:

- latest country/global ingestion
- state ingestion
- province ingestion
- historical ingestion
- full periodic synchronization
- summary cache precomputation

These jobs are handled by Celery workers and scheduled with Celery Beat.

## Testing

Backend tests:

```bash
cd backend
python manage.py test
```

Frontend tests:

```bash
cd frontend
npm test
```

The backend test suite covers sync status endpoints, ingestion commands, export endpoints, cache behavior, anomaly payloads, data quality metadata, country detail payloads, and vaccination-related metrics.

## Notes

- The project is intended for analytical and educational use.
- Data availability depends on third-party public sources.
- The predictive card in the frontend is a simple trend-based helper and not a medical or epidemiological forecasting model.

