terraform {
  required_version = ">= 1.5.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

provider "aws" {
  region = var.aws_region

  default_tags {
    tags = {
      Project     = "DropX"
      Environment = var.environment
      ManagedBy   = "Terraform"
      Repository  = var.github_repo
    }
  }
}
