# CloudWatch Metric Alarms for DropX Observability

# 1. ALB Unhealthy Target Host Alarm
resource "aws_cloudwatch_metric_alarm" "alb_unhealthy_hosts" {
  alarm_name          = "dropx-alb-unhealthy-hosts"
  comparison_operator = "GreaterThanOrEqualToThreshold"
  evaluation_periods  = 1
  metric_name         = "UnHealthyHostCount"
  namespace           = "AWS/ApplicationELB"
  period              = 60
  statistic           = "Average"
  threshold           = 1
  alarm_description   = "Triggers when ALB detects 1 or more unhealthy EC2 target instances"

  dimensions = {
    TargetGroup  = aws_lb_target_group.app_tg.arn_suffix
    LoadBalancer = aws_lb.app_alb.arn_suffix
  }
}

# 2. ALB Elevated HTTP 5xx Error Alarm
resource "aws_cloudwatch_metric_alarm" "alb_5xx_errors" {
  alarm_name          = "dropx-alb-5xx-errors"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 2
  metric_name         = "HTTPCode_Target_5XX_Count"
  namespace           = "AWS/ApplicationELB"
  period              = 300
  statistic           = "Sum"
  threshold           = 10
  alarm_description   = "Triggers when ALB target 5xx error count exceeds 10 in 5 minutes"

  dimensions = {
    LoadBalancer = aws_lb.app_alb.arn_suffix
  }
}

# 3. EC2 Auto Scaling Group High CPU Alarm
resource "aws_cloudwatch_metric_alarm" "ec2_high_cpu" {
  alarm_name          = "dropx-ec2-high-cpu"
  comparison_operator = "GreaterThanOrEqualToThreshold"
  evaluation_periods  = 2
  metric_name         = "CPUUtilization"
  namespace           = "AWS/EC2"
  period              = 300
  statistic           = "Average"
  threshold           = 80
  alarm_description   = "Triggers when average ASG EC2 CPU utilization exceeds 80%"

  dimensions = {
    AutoScalingGroupName = aws_autoscaling_group.app_asg.name
  }
}

# 4. RDS PostgreSQL High CPU Alarm
resource "aws_cloudwatch_metric_alarm" "rds_high_cpu" {
  count               = var.enable_rds ? 1 : 0
  alarm_name          = "dropx-rds-high-cpu"
  comparison_operator = "GreaterThanOrEqualToThreshold"
  evaluation_periods  = 2
  metric_name         = "CPUUtilization"
  namespace           = "AWS/RDS"
  period              = 300
  statistic           = "Average"
  threshold           = 80
  alarm_description   = "Triggers when RDS PostgreSQL CPU utilization exceeds 80%"

  dimensions = {
    DBInstanceIdentifier = aws_db_instance.postgres[0].identifier
  }
}

# 5. RDS PostgreSQL Low Free Storage Space Alarm
resource "aws_cloudwatch_metric_alarm" "rds_low_storage" {
  count               = var.enable_rds ? 1 : 0
  alarm_name          = "dropx-rds-low-storage"
  comparison_operator = "LessThanThreshold"
  evaluation_periods  = 1
  metric_name         = "FreeStorageSpace"
  namespace           = "AWS/RDS"
  period              = 300
  statistic           = "Average"
  threshold           = 5000000000 # 5 GB in bytes
  alarm_description   = "Triggers when RDS PostgreSQL free storage space falls below 5 GB"

  dimensions = {
    DBInstanceIdentifier = aws_db_instance.postgres[0].identifier
  }
}

# 6. ElastiCache Redis High Engine CPU Alarm
resource "aws_cloudwatch_metric_alarm" "redis_high_cpu" {
  alarm_name          = "dropx-redis-high-cpu"
  comparison_operator = "GreaterThanOrEqualToThreshold"
  evaluation_periods  = 2
  metric_name         = "EngineCPUUtilization"
  namespace           = "AWS/ElastiCache"
  period              = 300
  statistic           = "Average"
  threshold           = 80
  alarm_description   = "Triggers when ElastiCache Redis engine CPU utilization exceeds 80%"

  dimensions = {
    CacheClusterId = aws_elasticache_replication_group.redis.id
  }
}
