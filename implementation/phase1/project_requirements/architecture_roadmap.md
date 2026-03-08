# Architecture and Delivery Roadmap

## Target Architecture
```mermaid
flowchart LR
staff[StaffUsers] --> web[WebAppFrontend]
web --> auth[MicrosoftEntraAuth]
web --> api[CrmApi]
api --> domain[WorkflowDomain]
domain --> sheets[SpreadsheetDataStore]
domain --> graph[MicrosoftGraphAdapter]
domain --> qb[QuickBooksAdapter]
graph --> outlook[Outlook]
graph --> sharepoint[SharePointOneDrive]
domain --> files[AttachmentLinks]
domain --> audit[ActivityLog]
```

## Component Responsibilities

### `WebAppFrontend`
- Role-based screens for:
  - bid board
  - job/project board
  - work order board
  - personal task list
  - scheduling calendar
- Color-coded task indicators.
- Minimal friction data entry, optimized for operations speed.

### `MicrosoftEntraAuth`
- Standard Microsoft sign-in.
- User identity resolution to internal `Users` records.
- Role-based authorization in app/API.

### `CrmApi` + `WorkflowDomain`
- Core orchestration:
  - bid intake -> submit -> approve
  - bid -> project conversion
  - default phase generation
  - work order + task generation
  - strict payment-based phase gating
- Validation and business rules.
- Central activity logging.

### `SpreadsheetDataStore`
- Primary datastore in MVP.
- Controlled access via repository layer.
- Data integrity checks on writes.

### `MicrosoftGraphAdapter`
- Outlook references for source email chains.
- OneDrive/SharePoint document and photo links.
- Optional future sync of tasks to Microsoft task systems.

### `QuickBooksAdapter`
- MVP: map projects/work orders/invoices with reliable fallback mode.
- Post-MVP: deeper API sync where supported.

## Azure Free-Tier Aligned Direction
- Keep service count low:
  - one web app host
  - one lightweight API host
- Spreadsheet datastore minimizes infra overhead in early phases.
- Use managed identity patterns where possible for Microsoft integration.
- Defer heavy analytics/ETL until post-MVP.

## Delivery Milestones

## Milestone 0: Foundations (Week 1)
- Entra auth scaffolding.
- Spreadsheet schema creation and seed lookup values.
- API skeleton and repository abstraction.
- Initial UI shell and navigation.

Exit criteria:
- Users can sign in and read/write sample records with role checks.

## Milestone 1: Bid Operations (Weeks 2-3)
- Customer and bid CRUD.
- Bid assignment and follow-up workflow.
- Proposal template mapping and PDF generation.

Exit criteria:
- Team can run real bid workflow in system.

## Milestone 2: Project and Work Orders (Weeks 4-5)
- Bid-to-project conversion with date-sequence IDs.
- Default phase creation.
- Work order + task templates and assignment.
- Calendar/scheduling view.

Exit criteria:
- Team can execute active jobs from work order board.

## Milestone 3: Billing Gates and Controls (Weeks 6-7)
- Invoice-per-work-order model.
- Strict payment gating for phase progression.
- Inspection checkpoint handling.
- Blocked-work visibility and dashboard.

Exit criteria:
- Phase transitions are controlled by defined operational and financial rules.

## Milestone 4: Integration Hardening (Week 8+)
- QuickBooks adapter improvements.
- Outlook/SharePoint link automation refinements.
- Initial variance and KPI dashboard.

Exit criteria:
- Reduced duplicate entry and higher traceability across systems.

## Risks and Mitigations
- QuickBooks API constraints:
  - Mitigation: design robust fallback import/export mapping.
- Spreadsheet scale/concurrency:
  - Mitigation: strict repository writes, batching, archival strategy, and indexing tabs.
- Process adoption:
  - Mitigation: color-coded UX, defaults/templates, and minimal required fields at each stage.
- Data quality:
  - Mitigation: status gates + required field validation + audit trail.

## Definition of Success (Initial)
- No operational data trapped in personal silos.
- Every active job has visible owner, status, and next action.
- Work orders move through standardized lifecycle with evidence.
- Billing state is tied to execution state and phase control.
- Team can report actual vs estimate without manual reconciliation across disconnected tools.
