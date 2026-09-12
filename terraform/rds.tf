# Amazon RDS PostgreSQL Database Instance (Optional - set enable_rds = true to provision)
resource "aws_db_instance" "postgres" {
  count                       = var.enable_rds ? 1 : 0
  identifier                  = "dropx-postgres"
  engine                      = "postgres"
  engine_version              = "16.3"
  instance_class              = "db.t3.micro"
  allocated_storage           = 20
  max_allocated_storage       = 20
  storage_type                = "gp2"
  db_name                     = var.db_name
  username                    = var.db_username
  password                    = var.db_password
  db_subnet_group_name        = aws_db_subnet_group.rds[0].name
  vpc_security_group_ids      = [aws_security_group.rds_sg.id]
  publicly_accessible         = false
  multi_az                    = false
  storage_encrypted           = true
  skip_final_snapshot         = true
  deletion_protection         = false

  tags = {
    Name = "dropx-postgres-rds"
  }
}
