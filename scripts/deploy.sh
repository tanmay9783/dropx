#!/usr/bin/env bash

# DropX Multi-Instance EC2 Deployment Script (Phase 10 — HA Deployment)
# Execute on each EC2 instance (EC2-A, EC2-B) to ensure consistent application releases.
set -euo pipefail

echo "========================================="
echo "   DropX Multi-Instance HA Deployment    "
echo "========================================="

APP_DIR="/opt/dropx"
WEB_DIR="/var/www/dropx/frontend/dist"

cd "$APP_DIR"

echo "1. Fetching latest source code from repository..."
git pull origin main || echo "Git pull skipped (working with local directory state)"

echo "2. Installing backend production dependencies..."
cd "$APP_DIR/backend"
npm ci --omit=dev

echo "3. Installing frontend dependencies and building production bundle..."
cd "$APP_DIR/frontend"
npm ci
npm run build

echo "4. Deploying frontend build artifacts to web directory..."
sudo mkdir -p "$WEB_DIR"
sudo rm -rf "${WEB_DIR:?}/*"
sudo cp -r "$APP_DIR/frontend/dist/"* "$WEB_DIR/"
sudo chown -R www-data:www-data /var/www/dropx

echo "5. Restarting DropX Backend systemd service gracefully..."
sudo systemctl restart dropx-backend

echo "6. Reloading Nginx web server..."
sudo systemctl reload nginx

echo "========================================="
echo "   Instance Deployment Complete!          "
echo "========================================="
