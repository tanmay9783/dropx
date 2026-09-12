output "alb_dns_name" {
  value       = aws_lb.app_alb.dns_name
  description = "Public DNS name of the Application Load Balancer"
}

output "vpc_id" {
  value       = aws_vpc.main.id
  description = "VPC ID"
}

output "s3_bucket_name" {
  value       = aws_s3_bucket.file_bucket.id
  description = "DropX private S3 bucket name"
}

output "rds_endpoint" {
  value       = var.enable_rds ? aws_db_instance.postgres[0].endpoint : "SQLite (Local EC2 Disk - $0 Cost)"
  description = "Amazon RDS PostgreSQL private endpoint or SQLite mode"
}

output "redis_endpoint" {
  value       = aws_elasticache_replication_group.redis.primary_endpoint_address
  description = "ElastiCache Redis primary endpoint address"
}

output "asg_name" {
  value       = aws_autoscaling_group.app_asg.name
  description = "Auto Scaling Group Name"
}

output "target_group_arn" {
  value       = aws_lb_target_group.app_tg.arn
  description = "ALB Target Group ARN"
}

output "github_actions_role_arn" {
  value       = aws_iam_role.github_actions.arn
  description = "AWS IAM Role ARN for GitHub Actions OIDC Authentication"
}
