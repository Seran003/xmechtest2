# Xmechanicals Apps Script Prototype

This is a clickable Google Apps Script web app prototype for:

- Presales flow
- Job scheduling flow (Jobber-centric and inventory-free)

## Files

- `Code.gs` - Apps Script entry point (`doGet`)
- `Index.html` - Single-shell UI with mock state and view routing
- `appsscript.json` - Apps Script manifest

## Run Locally With Clasp

1. Authenticate:
   - `npx @google/clasp login`
2. Create and link a script project:
   - `npx @google/clasp create --type webapp --title "Xmechanicals Prototype"`
3. Push files:
   - `npx @google/clasp push`
4. Deploy as web app:
   - `npx @google/clasp deploy --description "prototype v1"`
5. Open deployed URL.

## Clickable Demo Path

1. Landing hub:
   - Open either `Presales Prototype` or `Job Scheduling Prototype`.
2. Presales (2 minutes):
   - Intake -> Estimate Builder -> Proposal Preview -> Proposal Status
   - Use `Next Status` to move from Draft to Signed.
3. Scheduling (2 minutes):
   - Jobs Board -> Job Detail -> Field Update -> Invoice Trigger
   - Use `Trigger Invoice` as visual finance handoff.

## Scope Notes

- No persistence or external API calls.
- All data is mock state inside `Index.html`.
- Inventory management is intentionally excluded from scheduling.
