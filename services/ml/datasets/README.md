# ML Datasets (Website Data)

This folder contains CSV files generated from the website database and used by the algorithm demo notebooks.

Datasets included:
- `rooms.csv`
- `users.csv`
- `interactions.csv`

These files now reflect actual site data and match the same recommendation logic used in `apps/api/src/routes/recommendations.ts`.

To refresh these CSVs from the database, run `pnpm --filter @workspace/scripts run export-datasets` from the repo root.

