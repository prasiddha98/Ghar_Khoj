# Ghar Khoj

This monorepo includes API, web, shared libraries, and database schema for the rental platform.

## Local migration

Run the Drizzle migration for `packages/shared/db`:

```bash
cd /Users/famous/Downloads/ghar-khoj-full
pnpm run db:migrate
```

If you need to run against the local Docker Postgres database:

```bash
cd /Users/famous/Downloads/ghar-khoj-full
docker compose up -d db
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/ghar_khoj pnpm run db:migrate
```

## Local Docker development

Start the full stack with Docker Compose:

```bash
cd /Users/famous/Downloads/ghar-khoj-full
docker compose up --build
```

Then open:
- Backend: http://localhost:3000
- Frontend: http://localhost:5173

## Render deployment

The `render.yaml` manifest is configured for this repository. It uses pnpm for the workspace and sets environment variables for production.

- API service uses: `pnpm install && pnpm --filter @workspace/api-server run build`
- Web service uses: `pnpm install && pnpm --filter @workspace/ghar-khoj run build`

## Notes

- `packages/shared/db/drizzle.config.ts` now points to `packages/shared/db/drizzle/migrations`
- `packages/shared/db/drizzle/migrations/0001_add_contract_payment_columns.sql` contains the contract payment schema upgrade
- `packages/shared/api-zod/src/index.ts` exports only `./generated/api` to avoid duplicate type export collisions
