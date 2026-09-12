variable "aws_region" {
  type        = string
  description = "AWS Region for DropX deployment"
  default     = "ap-south-1"
}

variable "environment" {
  type        = string
  description = "Deployment environment (e.g. production, staging, dev)"
  default     = "production"
}

variable "vpc_cidr" {
  type        = string
  description = "VPC CIDR block"
  default     = "10.0.0.0/16"
}

variable "instance_type" {
  type        = string
  description = "EC2 Instance Type for application nodes (Free Tier eligible)"
  default     = "t3.micro"
}

variable "min_asg_size" {
  type        = number
  description = "Minimum capacity for Auto Scaling Group"
  default     = 1
}

variable "max_asg_size" {
  type        = number
  description = "Maximum capacity for Auto Scaling Group"
  default     = 1
}

variable "desired_asg_capacity" {
  type        = number
  description = "Desired capacity for Auto Scaling Group (1 instance = 750 hrs/mo Free Tier)"
  default     = 1
}

variable "s3_bucket_name" {
  type        = string
  description = "Name of private S3 bucket for DropX file storage"
  default     = "dropx-prod-files-ap-south-1"
}

variable "db_name" {
  type        = string
  description = "PostgreSQL Database Name"
  default     = "dropx_prod"
}

variable "db_username" {
  type        = string
  description = "PostgreSQL Database Username"
  default     = "dropx_admin"
}

variable "enable_rds" {
  type        = bool
  description = "Set to true to provision RDS PostgreSQL, or false to use $0 cost SQLite on EC2 disk"
  default     = false
}

variable "db_password" {
  type        = string
  description = "PostgreSQL Database Password (only required if enable_rds is true)"
  sensitive   = true
  default     = "change_me_if_rds_enabled_123!"
}

variable "github_repo" {
  type        = string
  description = "GitHub repository (OWNER/REPO) for OIDC trust relationship"
  default     = "your-username/dropx"
}

variable "admin_ip" {
  type        = string
  description = "Trusted administrator IP address for SSH ingress access"
  default     = "0.0.0.0/0"
}
