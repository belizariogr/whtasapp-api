#!/bin/bash
bun install
docker container rm whatsapp-api --force
docker build -t whatsapp-api .
docker compose up -d
