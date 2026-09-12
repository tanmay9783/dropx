#!/usr/bin/env bash
exec > >(tee -a /var/log/dropx-bootstrap.log) 2>&1
echo "=== DropX EC2 Bootstrap Starting: $(date) ==="

export DEBIAN_FRONTEND=noninteractive

# 1. Install System Packages & Nginx
apt-get update -y
apt-get install -y curl git nginx ca-certificates gnupg

# 2. Install Node.js 20.x
if ! command -v node &> /dev/null; then
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt-get install -y nodejs
fi

# 3. Setup Directories
APP_DIR="/opt/dropx"
WEB_DIR="/var/www/dropx/frontend/dist"

mkdir -p "$WEB_DIR"
rm -rf "$APP_DIR"

# 4. Clone Repository
echo "=== Cloning Repository ==="
git clone https://github.com/tanmay9783/dropx.git "$APP_DIR"
cd "$APP_DIR"

# 5. Configure and Restart Nginx immediately
echo "=== Configuring Nginx ==="
rm -f /etc/nginx/sites-enabled/* /etc/nginx/sites-available/default
cp "$APP_DIR/aws/nginx/dropx.conf" /etc/nginx/sites-available/dropx.conf
ln -sf /etc/nginx/sites-available/dropx.conf /etc/nginx/sites-enabled/dropx.conf

# Copy pre-built frontend dist if available
if [ -d "$APP_DIR/frontend/dist" ]; then
  cp -r "$APP_DIR/frontend/dist/"* "$WEB_DIR/"
  chown -R www-data:www-data /var/www/dropx
fi

nginx -t && systemctl restart nginx

# 6. Install Backend Dependencies & Start Service
echo "=== Setting up Backend ==="
if [ -d "$APP_DIR/backend" ]; then
  cd "$APP_DIR/backend"
  mkdir -p data
  npm install --omit=dev || npm install
fi

if [ -f "$APP_DIR/aws/systemd/dropx-backend.service" ]; then
  cp "$APP_DIR/aws/systemd/dropx-backend.service" /etc/systemd/system/
  systemctl daemon-reload
  systemctl enable dropx-backend
  systemctl restart dropx-backend
fi

# 7. Build Fresh Frontend Assets
echo "=== Building Frontend ==="
if [ -d "$APP_DIR/frontend" ]; then
  cd "$APP_DIR/frontend"
  npm install
  npx vite build || true
  if [ -d "$APP_DIR/frontend/dist" ]; then
    cp -r "$APP_DIR/frontend/dist/"* "$WEB_DIR/"
    chown -R www-data:www-data /var/www/dropx
  fi
  systemctl restart nginx
fi

echo "=== DropX EC2 Bootstrap Finished: $(date) ==="
