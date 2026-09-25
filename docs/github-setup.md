# GitHub setup checklist

## Repository settings

- Protect `main` dan `develop`; require pull request + 1 review.
- Require status checks: `quality`, CodeQL, dan dependency review.
- Require conversation resolution before merge.
- Enable “Automatically delete head branches”.
- Add `OWNER/team` ke `.github/CODEOWNERS` sebelum production.
- Create GitHub Environments: `preview`, `staging`, `production`.
- Production environment: required reviewers, deployment branch restriction, protected secrets.

## Secrets

- Local: `.env` dari `.env.example`.
- CI: `CI_DATABASE_URL` hanya bila menjalankan integration test.
- Staging/production: provider keys, Sentry DSN, database URL, JWT secrets, web origin.
- Jangan pernah menggunakan production secret pada fork PR.

## Releases

- Tag: `vMAJOR.MINOR.PATCH`.
- Release notes wajib menyebut migration, security impact, dan rollback.
- Close issue yang sudah selesai dan tambahkan label `release:<version>`.
