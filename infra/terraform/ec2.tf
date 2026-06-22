locals {
  database_url = "postgresql://${var.db_username}:${random_password.db.result}@${aws_db_instance.main.address}:5432/${var.db_name}?schema=public"
  redis_url    = "redis://${aws_elasticache_replication_group.main.primary_endpoint_address}:6379"
}

resource "aws_instance" "app" {
  ami                    = data.aws_ami.amazon_linux_2023.id
  instance_type          = var.ec2_instance_type
  key_name               = var.ec2_key_name
  subnet_id              = aws_subnet.public[0].id
  vpc_security_group_ids = [aws_security_group.app.id]
  iam_instance_profile   = aws_iam_instance_profile.ec2_app.name

  user_data = templatefile("${path.module}/user-data.sh.tpl", {
    app_dir            = "/opt/dcb-backend"
    node_major         = "20"
    database_url       = local.database_url
    redis_url          = local.redis_url
    jwt_secret         = var.jwt_secret
    jwt_refresh_secret = var.jwt_refresh_secret
    cors_origins       = var.cors_origins
    aws_region         = var.aws_region
    s3_exports_bucket  = var.s3_exports_bucket
    s3_receipts_bucket = var.s3_receipts_bucket
    app_repo_url       = var.app_repo_url
  })

  user_data_replace_on_change = true

  root_block_device {
    volume_size = 30
    volume_type = "gp3"
    encrypted   = true
  }

  tags = {
    Name = "${local.name_prefix}-app"
  }
}
