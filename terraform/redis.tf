# Amazon ElastiCache Redis Cluster for Socket.IO Adapter & Shared Presence
resource "aws_elasticache_replication_group" "redis" {
  replication_group_id       = "dropx-redis-cluster"
  description                = "Redis replication group for Socket.IO signaling, presence and shared rate limiting"
  node_type                  = "cache.t3.micro" # Free Tier eligible trial node
  num_cache_clusters         = 1
  port                       = 6379
  subnet_group_name          = aws_elasticache_subnet_group.redis.name
  security_group_ids         = [aws_security_group.redis_sg.id]
  at_rest_encryption_enabled = true
  transit_encryption_enabled = false

  tags = {
    Name = "dropx-redis-cluster"
  }
}
