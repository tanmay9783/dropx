# 1. Application Load Balancer Security Group
resource "aws_security_group" "alb_sg" {
  name        = "dropx-alb-sg"
  description = "Public ingress access for HTTP and HTTPS"
  vpc_id      = aws_vpc.main.id

  ingress {
    description = "HTTP Public Ingress"
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  ingress {
    description = "HTTPS Public Ingress"
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  egress {
    description = "Allow all outbound traffic"
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name = "dropx-alb-sg"
  }
}

# 2. EC2 Application Security Group
resource "aws_security_group" "ec2_sg" {
  name        = "dropx-ec2-sg"
  description = "Application server security group restricted to ALB ingress"
  vpc_id      = aws_vpc.main.id

  ingress {
    description     = "HTTP ingress strictly from ALB SG"
    from_port       = 80
    to_port         = 80
    protocol        = "tcp"
    security_groups = [aws_security_group.alb_sg.id]
  }

  ingress {
    description = "SSH ingress restricted to admin IP"
    from_port   = 22
    to_port     = 22
    protocol    = "tcp"
    cidr_blocks = [var.admin_ip]
  }

  egress {
    description = "Allow outbound traffic (S3, package updates)"
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name = "dropx-ec2-sg"
  }
}

# 3. RDS PostgreSQL Security Group
resource "aws_security_group" "rds_sg" {
  name        = "dropx-rds-sg"
  description = "PostgreSQL database security group restricted to EC2 SG"
  vpc_id      = aws_vpc.main.id

  ingress {
    description     = "PostgreSQL ingress strictly from EC2 SG"
    from_port       = 5432
    to_port         = 5432
    protocol        = "tcp"
    security_groups = [aws_security_group.ec2_sg.id]
  }

  egress {
    description = "No outbound connection required"
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name = "dropx-rds-sg"
  }
}

# 4. Redis Security Group
resource "aws_security_group" "redis_sg" {
  name        = "dropx-redis-sg"
  description = "Redis security group restricted to EC2 SG"
  vpc_id      = aws_vpc.main.id

  ingress {
    description     = "Redis ingress strictly from EC2 SG"
    from_port       = 6379
    to_port         = 6379
    protocol        = "tcp"
    security_groups = [aws_security_group.ec2_sg.id]
  }

  egress {
    description = "No outbound connection required"
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name = "dropx-redis-sg"
  }
}
