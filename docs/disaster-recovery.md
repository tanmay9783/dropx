# DropX Operational Disaster Recovery & Incident Response Runbook

This runbook outlines operational procedures, detection mechanisms, and recovery steps for failure domains across DropX's highly available AWS architecture.

---

## 1. Single EC2 Instance Failure

- **Symptoms**: One EC2 instance crashes or stops responding to health checks.
- **Detection**: CloudWatch alarm `dropx-alb-unhealthy-hosts` triggers. ALB health check returns HTTP failure.
- **Immediate Impact**: Zero user downtime. ALB automatically deregisters the unhealthy target within 30 seconds and routes traffic exclusively to the remaining healthy instance.
- **Recovery Steps**:
  1. Auto Scaling Group (ASG) detects ELB health check failure and automatically launches a replacement EC2 node.
  2. Replacement instance executes `bootstrap.sh` user-data, fetches release, runs `dropx-backend`, and passes `/api/health` checks.
  3. ALB registers the new instance into the Target Group rotation.
- **Verification**: `curl http://$ALB_DNS/api/health` returns HTTP 200 OK across both target IPs.

---

## 2. Availability Zone (AZ) Outage

- **Symptoms**: Complete loss of an AWS Availability Zone (e.g. `ap-south-1a`).
- **Detection**: AWS Service Health Dashboard notification + ALB target health failure for AZ-1 targets.
- **Immediate Impact**: Traffic routed to EC2 node in surviving AZ-2 (`ap-south-1b`).
- **Recovery Steps**:
  1. RDS PostgreSQL automatically fails over to Multi-AZ standby replica in AZ-2.
  2. Redis adapter continues operating on surviving node.
  3. Once AZ-1 recovers, ASG replaces missing nodes to restore dual-AZ balance.

---

## 3. Application Load Balancer (ALB) Outage

- **Symptoms**: Public API / frontend requests time out or fail DNS resolution.
- **Detection**: External uptime monitoring or Route 53 health check alerts.
- **Immediate Impact**: Application unavailable.
- **Recovery Steps**:
  1. Inspect AWS Service Health Dashboard for regional ALB infrastructure events.
  2. If ALB configuration was corrupted, re-run GitHub Actions CD pipeline (`cd.yml`) or execute `terraform apply -target=aws_lb.app_alb`.

---

## 4. RDS PostgreSQL Database Failure & Snapshot Restoration

- **Symptoms**: Backend logs show `ECONNREFUSED` or PostgreSQL connection timeouts.
- **Detection**: CloudWatch alarm `dropx-rds-high-cpu` or connection pressure.
- **Immediate Impact**: API requests requiring DB read/write fail with HTTP 500 error.
- **Recovery Steps**:
  1. **Automatic Failover**: In a Multi-AZ deployment, RDS automatically promotes the standby replica to primary within 60-120 seconds. Backend connection pool reconnects automatically.
  2. **Point-in-Time Restoration** (if data corruption occurs):
     ```bash
     aws rds restore-db-instance-to-point-in-time \
       --source-db-instance-identifier dropx-postgres \
       --target-db-instance-identifier dropx-postgres-restored \
       --restore-time 2026-09-12T20:00:00.000Z
     ```
  3. Update `DATABASE_URL` in SSM Parameter Store and trigger ASG instance refresh.

---

## 5. ElastiCache Redis Outage & Graceful Degradation

- **Symptoms**: Backend logs display `Redis Main Client Error`.
- **Detection**: CloudWatch alarm `dropx-redis-high-cpu` or engine metric drop.
- **Immediate Impact**:
  - Socket.IO signaling degrades to single-instance broadcasting.
  - Rate limiting falls back to local memory store without crashing backend processes.
  - Cleanup job falls back to local execution.
- **Recovery Steps**:
  1. ElastiCache automatically restarts or failovers Redis primary node.
  2. Backend `ioredis` client automatically reconnects with exponential backoff strategy.

---

## 6. S3 Bucket & Object Recovery

- **Symptoms**: Presigned URL generation or S3 object downloads fail (`NoSuchKey` / `AccessDenied`).
- **Detection**: Backend Pino HTTP error logs during `HeadObject` verification (`POST /complete`).
- **Recovery Steps**:
  1. Verify S3 Block Public Access and Bucket Policy settings (`s3.tf`).
  2. S3 `force_destroy` is disabled by default to prevent accidental bucket deletion during Terraform execution.
  3. For object loss, temporary file sharing allows users to re-upload.

---

## 7. Accidental File Deletion Recovery

- **Symptoms**: User reports missing uploaded file in active room.
- **Immediate Impact**: S3 object deleted via application lifecycle worker or explicit user deletion.
- **Recovery Strategy**:
  - DropX files are intentionally **ephemeral** with a strict 2-hour TTL.
  - Expired or deleted files are deleted permanently by design (Option C deletion model).

---

## 8. Application Deployment Failure & Rolling Rollback

- **Symptoms**: New code release causes HTTP 5xx errors or failed health gate checks during CD deployment.
- **Detection**: CD workflow `cd.yml` health check step fails.
- **Recovery Steps**:
  1. Trigger GitHub Actions `cd.yml` workflow specifying previous known-good Git release tag or commit SHA.
  2. ASG executes rolling instance refresh replacing nodes with the stable release:
     ```bash
     aws autoscaling start-instance-refresh \
       --auto-scaling-group-name dropx-asg \
       --preferences '{"MinHealthyPercentage": 50}'
     ```

---

## 9. Security Credential Compromise & Secret Rotation Protocol

If a production secret (`SOCKET_TOKEN_SECRET`, `DATABASE_URL`, or AWS IAM OIDC) is exposed:

1. **Rotate `SOCKET_TOKEN_SECRET`**:
   Update value in SSM Parameter Store / AWS Secrets Manager.
2. **Rotate Database Password**:
   Update PostgreSQL master password in RDS and update `DATABASE_URL` secret.
3. **Revoke IAM Role**:
   Detach policies from compromised IAM role or update GitHub Actions OIDC condition.
4. **Trigger Rolling Deployment**:
   Execute `cd.yml` to update environment configuration on all EC2 instances simultaneously.

---

## 10. GitHub Actions Pipeline Outage

- **Symptoms**: GitHub Actions runner unavailable.
- **Recovery Steps**:
  1. Fall back to manual local Terraform execution using AWS CLI credentials:
     ```bash
     cd terraform
     terraform plan
     terraform apply
     ```
  2. Execute [`scripts/deploy.sh`](file:///home/tanmay/Videos/qr/scripts/deploy.sh) directly on EC2 instances over SSH.
