# Jab Application

Production-grade, SOC 2–aligned web application foundation: secure auth, RBAC, and admin CRM base.

## Tech Stack

- **Frontend**: Next.js 14 (App Router), TypeScript, Tailwind CSS
- **Backend**: Node.js, TypeScript, Fastify, Prisma, PostgreSQL
- **Auth**: JWT (access + refresh), HTTP-only cookies, bcrypt, RBAC, rate limiting

## Quick Start

### 1. Environment

```bash
cp .env.example .env
# Edit .env: set DATABASE_URL, JWT_ACCESS_SECRET, JWT_REFRESH_SECRET (min 32 chars each)
```

Backend and frontend use the same `.env` at repo root for convenience; in production use separate env (e.g. backend in server, frontend `NEXT_PUBLIC_API_URL` only).

### 2. Database

```bash
cd backend
npm install
npx prisma migrate dev --name init
npm run db:seed
```

### 3. Run

**Terminal 1 – Backend**

```bash
cd backend && npm run dev
```

**Terminal 2 – Frontend**

```bash
cd frontend
cp .env.local.example .env.local  # set NEXT_PUBLIC_API_URL=http://localhost:4000
npm install && npm run dev
```

- Frontend: http://localhost:3000  
- Backend: http://localhost:4000  

### 4. Login

After seed: **admin@example.com** / **Admin123!** (change in production).

## Project Structure

```
├── backend/
│   ├── prisma/           # Schema, migrations, seed
│   └── src/
│       ├── config/       # Env validation
│       ├── middleware/   # Auth, permission, error, rate limit
│       ├── repositories/
│       ├── routes/       # Auth, me, users, roles
│       ├── services/     # Auth (JWT, login, refresh, logout)
│       ├── validations/  # Zod schemas
│       └── utils/        # Logger, hash
├── frontend/
│   └── src/
│       ├── app/          # Next.js App Router (login, dashboard, users, roles, permissions)
│       ├── contexts/     # Auth
│       └── lib/          # API client
└── .env.example
```

## Security

- **Auth**: JWT access (short-lived) + refresh (rotated), HTTP-only cookies, token revocation
- **Passwords**: bcrypt (12 rounds)
- **API**: Rate limiting (auth routes stricter), centralized error handling, Zod validation, secure headers (Helmet)
- **RBAC**: Roles (Super Admin, Admin, Manager) and permissions (view_dashboard, manage_users, manage_roles)
- **SOC 2**: Access control, least privilege, audit-ready structure; comments where audit logs will be added

## Future Scalability (comments in code)

- **Multi-tenancy**: Add `tenantId` to users/roles and filter by tenant
- **Subscriptions & billing**: New `subscriptions` / `plans` tables and service
- **Audit logs**: `audit_events` table or external service; log mutations and access denials
- **External SSO**: Auth0/Okta via strategy layer in auth service
- **Microservices**: Split auth, users, and billing into separate services and gateways

## Scripts

| Command        | Description                |
|----------------|----------------------------|
| `npm run dev`  | Backend + frontend (root)  |
| `npm run db:migrate` | Prisma migrate (from root) |
| `npm run db:seed`   | Seed roles, permissions, admin |
| `npm run db:studio`| Prisma Studio              |

## License

Private.
