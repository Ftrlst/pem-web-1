# Infrastructure

`docker-compose.yml` adalah default single-outlet untuk staging/MVP. Untuk production, gunakan managed PostgreSQL/Redis, TLS termination (Cloudflare/CloudFront/Traefik), secret manager, backup PITR, dan monitoring eksternal.

Kubernetes manifests berada di `k8s/` sebagai target fase pertumbuhan, bukan syarat MVP.
