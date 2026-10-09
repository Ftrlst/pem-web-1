# Infrastructure

`docker-compose.yml` adalah default single-outlet untuk staging/MVP. Compose menjalankan migration sekali sebelum API, lalu mengekspos API lokal dan Nginx gateway. `NEXT_PUBLIC_API_URL` harus diberikan sebagai build argument agar browser memakai URL yang benar.

Untuk production, gunakan managed MySQL/Redis, TLS termination (Cloudflare/CloudFront/Traefik), secret manager, backup PITR, dan monitoring eksternal. Kubernetes manifests berada di `k8s/` sebagai target fase pertumbuhan, bukan syarat MVP.
