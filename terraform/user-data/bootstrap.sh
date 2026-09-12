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

APP_DIR="/opt/dropx"
rm -rf "$APP_DIR"

# 3. Clone Repository
echo "=== Cloning Repository ==="
git clone https://github.com/tanmay9783/dropx.git "$APP_DIR"
cd "$APP_DIR"

# 4. Deploy React Frontend directly to /var/www/html
echo "=== Deploying Frontend ==="
mkdir -p /var/www/html /var/www/dropx/frontend/dist

# If pre-built dist exists, copy it immediately
if [ -d "$APP_DIR/frontend/dist" ]; then
  cp -rf "$APP_DIR/frontend/dist/"* /var/www/html/
fi

# Build frontend to ensure all assets are compiled
cd "$APP_DIR/frontend"
npm install
npx vite build || true
if [ -d "$APP_DIR/frontend/dist" ]; then
  cp -rf "$APP_DIR/frontend/dist/"* /var/www/html/
  cp -rf "$APP_DIR/frontend/dist/"* /var/www/dropx/frontend/dist/
fi

chmod -R 755 /var/www
chown -R www-data:www-data /var/www/html /var/www/dropx

# 5. Overwrite Nginx default configuration directly
echo "=== Configuring Nginx ==="
cat << 'EOF' > /etc/nginx/sites-available/default
server {
    listen 80 default_server;
    listen [::]:80 default_server;
    root /var/www/html;
    index index.html;
    server_name _;

    location / {
        try_files $uri $uri/ /index.html;
        add_header Cache-Control "no-cache, no-store, must-revalidate";
    }

    location /api/ {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $http_x_forwarded_proto;
    }

    location /socket.io/ {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "Upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $http_x_forwarded_proto;
    }
}
EOF

ln -sf /etc/nginx/sites-available/default /etc/nginx/sites-enabled/default
systemctl restart nginx

# 6. Install backend dependencies & start systemd service
echo "=== Setting up Backend ==="
cd "$APP_DIR/backend"
mkdir -p data
npm install --omit=dev || npm install

cat << 'EOF' > /etc/systemd/system/dropx-backend.service
[Unit]
Description=DropX Node.js Backend Service
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=/opt/dropx/backend
Environment=NODE_ENV=production
Environment=PORT=3000
Environment=STORAGE_PROVIDER=local
ExecStart=/usr/bin/node src/server.js
Restart=always
RestartSec=3s

StandardOutput=journal
StandardError=journal
SyslogIdentifier=dropx-backend

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable dropx-backend
systemctl restart dropx-backend
systemctl restart nginx

echo "=== DropX EC2 Bootstrap Finished: $(date) ==="
