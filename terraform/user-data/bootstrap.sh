#!/usr/bin/env bash
exec > >(tee -a /var/log/dropx-bootstrap.log) 2>&1
echo "=== DropX EC2 Bootstrap Starting: $(date) ==="

export DEBIAN_FRONTEND=noninteractive

# 1. Update OS and install Nginx, Node.js, and AWS CLI
apt-get update -y
apt-get install -y curl git nginx ca-certificates gnupg build-essential awscli

if ! command -v node &> /dev/null; then
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt-get install -y nodejs
fi

# 2. Setup Application Directories
APP_DIR="/opt/dropx"
rm -rf "$APP_DIR" /tmp/dropx-app.tar.gz
mkdir -p "$APP_DIR" /var/www/html /var/www/dropx/frontend/dist

# 3. Download Deployment Package from S3 (IAM Authenticated)
echo "=== Downloading DropX from S3 ==="
aws s3 cp s3://dropx-prod-files-ap-south-1/deploy/dropx-app.tar.gz /tmp/dropx-app.tar.gz --region ap-south-1 || true

if [ -f /tmp/dropx-app.tar.gz ]; then
  tar -xzf /tmp/dropx-app.tar.gz -C "$APP_DIR"
else
  git clone https://github.com/tanmay9783/dropx.git "$APP_DIR" || true
fi

# 4. Deploy Frontend Assets directly to /var/www/html
echo "=== Deploying Frontend Assets ==="
rm -rf /var/www/html/*
if [ -d "$APP_DIR/frontend/dist" ]; then
  cp -rf "$APP_DIR/frontend/dist/"* /var/www/html/
  cp -rf "$APP_DIR/frontend/dist/"* /var/www/dropx/frontend/dist/
fi
chmod -R 755 /var/www
chown -R www-data:www-data /var/www/html /var/www/dropx

# 5. Overwrite Nginx Configuration
echo "=== Configuring Nginx ==="
cat << 'EOF' > /etc/nginx/sites-available/default
server {
    listen 80 default_server;
    listen [::]:80 default_server;
    root /var/www/html;
    index index.html index.htm;
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

# 6. Install Production Backend Dependencies & Start Service
echo "=== Setting up Backend ==="
if [ -d "$APP_DIR/backend" ]; then
  cd "$APP_DIR/backend"
  mkdir -p data storage/uploads
  chmod -R 777 data storage
  npm install --omit=dev || npm install
fi

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
Environment=STORAGE_PROVIDER=s3
Environment=S3_BUCKET_NAME=dropx-prod-files-ap-south-1
Environment=AWS_REGION=ap-south-1
Environment=ALLOWED_ORIGINS=*
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

echo "=== DropX EC2 Bootstrap Finished Successfully: $(date) ==="
