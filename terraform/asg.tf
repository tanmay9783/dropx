# EC2 Launch Template for Multi-AZ Application Instances
resource "aws_launch_template" "app_lt" {
  name_prefix   = "dropx-app-lt-"
  image_id      = "ami-03f054457d840a28d" # Standard Ubuntu 22.04 LTS AMI in ap-south-1
  instance_type = var.instance_type

  iam_instance_profile {
    name = aws_iam_instance_profile.ec2_profile.name
  }

  vpc_security_group_ids = [aws_security_group.ec2_sg.id]

  user_data = filebase64("${path.module}/user-data/bootstrap.sh")

  tag_specifications {
    resource_type = "instance"
    tags = {
      Name        = "dropx-app-node"
      Project     = "DropX"
      Environment = var.environment
    }
  }

  lifecycle {
    create_before_destroy = true
  }
}

# Auto Scaling Group Spanning 2 Availability Zones
resource "aws_autoscaling_group" "app_asg" {
  name_prefix         = "dropx-asg-"
  min_size            = var.min_asg_size
  max_size            = var.max_asg_size
  desired_capacity    = var.desired_asg_capacity
  vpc_zone_identifier = [aws_subnet.private_az1.id, aws_subnet.private_az2.id]
  target_group_arns   = [aws_lb_target_group.app_tg.arn]

  launch_template {
    id      = aws_launch_template.app_lt.id
    version = "$Latest"
  }

  health_check_type         = "ELB"
  health_check_grace_period = 300
  force_delete              = false

  lifecycle {
    create_before_destroy = true
  }

  tag {
    key                 = "Name"
    value               = "dropx-asg-node"
    propagate_at_launch = true
  }
}
