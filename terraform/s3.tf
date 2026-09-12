# Private S3 Bucket for DropX Temporary File Storage
resource "aws_s3_bucket" "file_bucket" {
  bucket        = var.s3_bucket_name
  force_destroy = false

  tags = {
    Name = "dropx-file-storage"
  }
}

# Block Public Access Configuration (All 4 ON)
resource "aws_s3_bucket_public_access_block" "file_bucket_bpa" {
  bucket = aws_s3_bucket.file_bucket.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# Server-Side Encryption (AES256)
resource "aws_s3_bucket_server_side_encryption_configuration" "file_bucket_sse" {
  bucket = aws_s3_bucket.file_bucket.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

# Enforce Encrypted HTTPS-Only Bucket Policy
resource "aws_s3_bucket_policy" "file_bucket_policy" {
  bucket = aws_s3_bucket.file_bucket.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid       = "EnforceSSLRequestsOnly"
        Effect    = "Deny"
        Principal = "*"
        Action    = "s3:*"
        Resource = [
          aws_s3_bucket.file_bucket.arn,
          "${aws_s3_bucket.file_bucket.arn}/*"
        ]
        Condition = {
          Bool = {
            "aws:SecureTransport" = "false"
          }
        }
      }
    ]
  })
}

# S3 Lifecycle Rule (Safety-Net Cleanup for abandoned objects after 1 day)
resource "aws_s3_bucket_lifecycle_configuration" "file_bucket_lifecycle" {
  bucket = aws_s3_bucket.file_bucket.id

  rule {
    id     = "abandoned-objects-safety-net"
    status = "Enabled"

    filter {
      prefix = "rooms/"
    }

    expiration {
      days = 1
    }
  }
}

# S3 Bucket CORS Configuration for Direct Browser Presigned PUT Uploads and GET Downloads
resource "aws_s3_bucket_cors_configuration" "file_bucket_cors" {
  bucket = aws_s3_bucket.file_bucket.id

  cors_rule {
    allowed_headers = ["*"]
    allowed_methods = ["PUT", "POST", "GET", "HEAD", "DELETE"]
    allowed_origins = ["*"]
    expose_headers  = ["ETag"]
    max_age_seconds = 3600
  }
}

