#!/usr/bin/env bash
# DropX EC2 User-Data Bootstrap Script
set -euo pipefail

echo "========================================="
echo "   Bootstrapping DropX EC2 Instance       "
echo "========================================="

# 1. Update OS packages and install Node.js & Nginx
sudo apt-get update -y
sudo apt-get install -y curl git nginx

if ! command -v node &> /dev/null; then
  curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
  sudo apt-get install -y nodejs
fi

# 2. Setup system user
if ! id "dropx" &>/dev/null; then
  sudo useradd -r -s /bin/false dropx
fi

APP_DIR="/opt/dropx"
WEB_DIR="/var/www/dropx/frontend/dist"

sudo mkdir -p "$APP_DIR" "$WEB_DIR"
sudo chown -R ubuntu:ubuntu "$APP_DIR" "$WEB_DIR"

# 3. Pull repository code
if [ ! -d "$APP_DIR/.git" ]; then
  git clone https://github.com/tanmay9783/dropx.git "$APP_DIR"
else
  cd "$APP_DIR" && git pull origin main
fi

cd "$APP_DIR"

# 4. Link Nginx and Systemd service immediately
if [ -f "$APP_DIR/aws/nginx/dropx.conf" ]; then
  sudo cp "$APP_DIR/aws/nginx/dropx.conf" /etc/nginx/sites-available/dropx.conf
  sudo rm -f /etc/nginx/sites-enabled/default
  sudo ln -sf /etc/nginx/sites-available/dropx.conf /etc/nginx/sites-enabled/dropx.conf
  sudo nginx -t && sudo systemctl reload nginx
fi

if [ -f "$APP_DIR/aws/systemd/dropx-backend.service" ]; then
  sudo cp "$APP_DIR/aws/systemd/dropx-backend.service" /etc/systemd/system/
  sudo systemctl daemon-reload
  sudo systemctl enable dropx-backend
fi

# 5. Install backend dependencies & start backend
if [ -d "$APP_DIR/backend" ]; then
  cd "$APP_DIR/backend"
  mkdir -p data
  npm install --omit=dev || npm install
  sudo systemctl restart dropx-backend || true
fi

# 6. Build frontend static assets (use lightweight vite build to avoid tsc OOM on t3.micro)
if [ -d "$APP_DIR/frontend" ]; then
  cd "$APP_DIR/frontend"
  npm install
  npx vite build || echo "Vite build failed"
  if [ -d "$APP_DIR/frontend/dist" ]; then
    sudo mkdir -p "$WEB_DIR"
    sudo cp -r "$APP_DIR/frontend/dist/"* "$WEB_DIR/"
  fi
  sudo chown -R www-data:www-data /var/www/dropx
  sudo systemctl reload nginx
fi

echo "========================================="
echo "   Bootstrap Complete!                    "
echo "========================================="
