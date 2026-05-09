This repository includes a Docker-based way to run both the backend and frontend together.

Prerequisites
- Docker and Docker Compose installed on your machine.

Quick start

1. From the repo root, build and start both services:

```bash
docker compose up --build
```

2. After successful build:
- Backend: http://localhost:3000
- Frontend (Vite dev): http://localhost:5173

Notes
- The Dockerfiles install `pnpm` inside the image and run the monorepo workspace install so workspace dependencies resolve.
- Frontend runs in Vite dev mode (hot reload). For a production build, run `pnpm --filter @workspace/ghar-khoj build` and serve the built `dist` with a static server.
