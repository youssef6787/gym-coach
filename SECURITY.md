# Security & Secrets — Step 1

## Environment variables

The application now reads sensitive configuration
from environment variables and validates them
when the backend starts.

Required variables:

- DB_HOST
- DB_USER
- DB_PASSWORD
- DB_NAME
- DB_PORT
- JWT_SECRET

Optional variables:

- NODE_ENV
- PORT

---

## Local setup

1. Open the backend folder.

2. Copy:

backend/.env.example

to:

backend/.env

3. Put your real database credentials inside:

backend/.env

4. Generate a strong JWT secret:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"