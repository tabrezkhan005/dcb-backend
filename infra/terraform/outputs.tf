output "api_url" {
  description = "Public HTTPS base URL for the mobile app (no trailing slash)"
  value       = local.use_custom_domain ? "https://${var.api_domain_name}" : "https://${aws_cloudfront_distribution.api.domain_name}"
}

output "api_v1_url" {
  description = "Full API prefix for EXPO_PUBLIC_API_URL"
  value       = "${local.use_custom_domain ? "https://${var.api_domain_name}" : "https://${aws_cloudfront_distribution.api.domain_name}"}/api/v1"
}

output "cloudfront_domain" {
  value = aws_cloudfront_distribution.api.domain_name
}

output "alb_dns_name" {
  value = aws_lb.main.dns_name
}

output "ec2_public_ip" {
  value = aws_instance.app.public_ip
}

output "ec2_instance_id" {
  value = aws_instance.app.id
}

output "rds_endpoint" {
  value     = aws_db_instance.main.endpoint
  sensitive = true
}

output "redis_primary_endpoint" {
  value = aws_elasticache_replication_group.main.primary_endpoint_address
}

output "database_url" {
  description = "For manual deploy / debugging (sensitive)"
  value       = local.database_url
  sensitive   = true
}

output "ssh_command" {
  value = "ssh -i YOUR_KEY.pem ec2-user@${aws_instance.app.public_ip}"
}

output "db_password" {
  description = "RDS master password (sensitive)"
  value       = random_password.db.result
  sensitive   = true
}
