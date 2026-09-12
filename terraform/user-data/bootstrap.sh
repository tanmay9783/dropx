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
sudo chown -R ubuntu:ubuntu "$APP_DIR"

# 3. Pull repository code (if git target is set)
if [ ! -d "$APP_DIR/.git" ]; then
  git clone https://github.com/your-username/dropx.git "$APP_DIR" || echo "Git clone skipped"
fi

cd "$APP_DIR"

# 4. Install backend dependencies and build frontend
if [ -d "$APP_DIR/backend" ]; then
  cd "$APP_DIR/backend"
  npm ci --omit=dev || npm install --omit=dev
fi

if [ -d "$APP_DIR/frontend" ]; then
  cd "$APP_DIR/frontend"
  npm ci || npm install
  npm run build || echo "Frontend build failed"
  sudo cp -r "$APP_DIR/frontend/dist/"* "$WEB_DIR/"
  sudo chown -R www-data:www-data /var/www/dropx
fi

# 5. Enable systemd service and Nginx
if [ -f "$APP_DIR/aws/systemd/dropx-backend.service" ]; then
  sudo cp "$APP_DIR/aws/systemd/dropx-backend.service" /etc/systemd/system/
  sudo systemctl daemon-reload
  sudo systemctl enable dropx-backend
  sudo systemctl restart dropx-backend || echo "Backend start delayed"
fi

if [ -f "$APP_DIR/aws/nginx/dropx.conf" ]; then
  sudo cp "$APP_DIR/aws/nginx/dropx.conf" /etc/nginx/sites-available/dropx.conf
  sudo ln -sf /etc/nginx/sites-available/dropx.conf /etc/nginx/sites-enabled/default
  sudo nginx -t && sudo systemctl reload nginx || echo "Nginx reload delayed"
fi

echo "========================================="
echo "   Bootstrap Complete!                    "
echo "========================================="
