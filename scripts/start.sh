#!/bin/bash

# Get the directory of the current script
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

docker compose -f "${SCRIPT_DIR}/docker-compose.yml" -p cvd-hub up --build
