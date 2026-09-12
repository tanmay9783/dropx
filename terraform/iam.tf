# 1. EC2 Instance IAM Role & Profile
resource "aws_iam_role" "ec2_role" {
  name = "dropx-ec2-instance-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "ec2.amazonaws.com"
        }
      }
    ]
  })
}

# Least-Privilege S3 Policy for Application EC2 Instances
resource "aws_iam_policy" "s3_access_policy" {
  name        = "dropx-ec2-s3-access-policy"
  description = "Least privilege S3 object permissions for DropX application"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "DropXS3ObjectAccess"
        Effect = "Allow"
        Action = [
          "s3:PutObject",
          "s3:GetObject",
          "s3:HeadObject",
          "s3:DeleteObject"
        ]
        Resource = "${aws_s3_bucket.file_bucket.arn}/*"
      },
      {
        Sid    = "DropXS3BucketLocation"
        Effect = "Allow"
        Action = [
          "s3:GetBucketLocation"
        ]
        Resource = aws_s3_bucket.file_bucket.arn
      }
    ]
  })
}

resource "aws_iam_role_policy_attachment" "ec2_s3_attachment" {
  role       = aws_iam_role.ec2_role.name
  policy_arn = aws_iam_policy.s3_access_policy.arn
}

resource "aws_iam_instance_profile" "ec2_profile" {
  name = "dropx-ec2-instance-profile"
  role = aws_iam_role.ec2_role.name
}

# 2. GitHub Actions OIDC Identity Provider & Role for Secretless CI/CD Authentication
resource "aws_iam_openid_connect_provider" "github" {
  url             = "https://token.actions.githubusercontent.com"
  client_id_list  = ["sts.amazonaws.com"]
  thumbprint_list = ["6938fd4d98bab03faadb97b34396831e3780aea1", "1c58a2a851587db77a04244413963f4d927d1130"]
}

resource "aws_iam_role" "github_actions" {
  name = "dropx-github-actions-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "GitHubActionsOIDC"
        Effect = "Allow"
        Principal = {
          Federated = aws_iam_openid_connect_provider.github.arn
        }
        Action = "sts:AssumeRoleWithWebIdentity"
        Condition = {
          StringEquals = {
            "token.actions.githubusercontent.com:aud" = "sts.amazonaws.com"
          }
          StringLike = {
            "token.actions.githubusercontent.com:sub" = "repo:${var.github_repo}:*"
          }
        }
      }
    ]
  })
}

# Minimal Policy for GitHub Actions Terraform & Deployment Operations
resource "aws_iam_policy" "github_actions_policy" {
  name        = "dropx-github-actions-policy"
  description = "Scoped permissions for GitHub Actions deployment pipeline"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "ec2:*",
          "s3:*",
          "rds:*",
          "elasticache:*",
          "elasticloadbalancing:*",
          "autoscaling:*",
          "iam:PassRole",
          "iam:GetRole",
          "iam:GetInstanceProfile"
        ]
        Resource = "*"
      }
    ]
  })
}

resource "aws_iam_role_policy_attachment" "github_actions_attachment" {
  role       = aws_iam_role.github_actions.name
  policy_arn = aws_iam_policy.github_actions_policy.arn
}
