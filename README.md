# X Mechanicals MVP Monolith

KISS architecture for MVP:
- one deployable app (monolith)
- HTML + vanilla JS frontend in `public/`
- server-side API routes in `src/api.js`
- Excel workbook datastore in `../db_files/CRM_Datastore_Quickstart_v1.xlsx`

This is intentionally simple for a low-volume internal team and can later be split into separate frontend/backend deployments if needed.

## Current user flow
1. Create Bid
2. Assign Bid task
3. Complete assignment (task-driven status updates)
4. Convert Bid to Project
5. Create/Assign Work Order (Installer)
6. Complete Work Order assignment
7. Schedule Work Order

## Folder structure
```text
monolith/
  server.js
  package.json
  public/
    index.html
    app.js
  src/
    api.js
    store.js
```

## Local run
```bash
cd implementation/phase1/monolith
npm install
npm run dev
```

Open: `http://localhost:3000`

## Common local issue
If you see `EADDRINUSE: address already in use :::3000`, either:
- stop the existing process on port 3000, or
- run on another port:

```bash
PORT=3001 npm run dev
```

## API endpoints (starter)
- `GET /api/health`
- `GET /api/bids`
- `POST /api/bids`
- `POST /api/bids/:bidId/assign`
- `POST /api/bids/:bidId/submit`
- `POST /api/bids/:bidId/convert-to-project`
- `GET /api/projects`
- `GET /api/work-orders`
- `POST /api/work-orders`
- `POST /api/work-orders/:workOrderId/assign`
- `POST /api/work-orders/:workOrderId/complete`
- `POST /api/assignments/:assignmentId/complete`
- `GET /api/my-tasks`
- `POST /api/schedule`

## Datastore assumptions
- Customer, client contact, and installer data already exist in workbook tabs.
- Assignment completion should drive status updates for bids/work orders.

## Next implementation steps
- Add Entra ID auth middleware (M365-only access).
- Resolve authenticated user -> `Users.UserId`.
- Add role checks (`admin`, `project_manager`, `estimator`, `installer`).
- Add activity logging on all write endpoints.
