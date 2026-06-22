variable "aws_region" {
  type        = string
  description = "AWS region (must match S3 buckets)"
  default     = "ap-south-2"
}

variable "project_name" {
  type        = string
  default     = "dcb-ap"
}

variable "environment" {
  type        = string
  default     = "production"
}

variable "vpc_cidr" {
  type    = string
  default = "10.20.0.0/16"
}

# EC2
variable "ec2_instance_type" {
  type    = string
  default = "t3.small"
}

variable "ec2_key_name" {
  type        = string
  description = "Existing EC2 key pair name in this region (for SSH)"
}

variable "app_repo_url" {
  type        = string
  description = "Git URL to clone backend (optional; leave empty to deploy code manually)"
  default     = ""
}

# RDS
variable "db_name" {
  type    = string
  default = "dcb_ap"
}

variable "db_username" {
  type    = string
  default = "dcb_admin"
}

variable "db_instance_class" {
  type    = string
  default = "db.t3.micro"
}

variable "db_allocated_storage_gb" {
  type    = number
  default = 20
}

# ElastiCache
variable "redis_node_type" {
  type    = string
  default = "cache.t3.micro"
}

# S3 (existing buckets)
variable "s3_exports_bucket" {
  type = string
}

variable "s3_receipts_bucket" {
  type = string
}

# App secrets (set in terraform.tfvars — never commit real values)
variable "jwt_secret" {
  type      = string
  sensitive = true
}

variable "jwt_refresh_secret" {
  type      = string
  sensitive = true
}

variable "cors_origins" {
  type        = string
  description = "Comma-separated origins; use * only for initial device testing"
  default     = "*"
}

# Optional custom domain (Route 53 + ACM). Leave empty to use the CloudFront default HTTPS URL.
variable "api_domain_name" {
  type    = string
  default = ""
}

variable "route53_zone_id" {
  type        = string
  description = "Route 53 hosted zone ID for api_domain_name"
  default     = ""
}

# SSH access to EC2 (restrict to your IP in production)
variable "ssh_cidr_blocks" {
  type        = list(string)
  description = "CIDRs allowed to SSH to the app server"
  default     = ["0.0.0.0/0"]
}
