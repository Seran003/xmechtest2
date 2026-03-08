# CRM Discovery and Foundation

## Source Materials Reviewed
- Audio transcripts:
  - `project_requirements/req_recording/transcripts/Feb 27 at 3-08 PM.srt`
  - `project_requirements/req_recording/transcripts/Feb 27 at 4-02 PM.srt`
- Proposal:
  - `project_requirements/X Mechanicals HVAC Proposal  Bird Dog Group 2440 Bertania Circle Foxtrot.docx`
- Estimating workbook:
  - `project_requirements/Bird Dog Group - 2440 Bertania Cir  Ebert  HVAC Mark Up Summary Sheet.xlsx`

## Business Context
X Mechanicals currently runs a multi-step flow across email, spreadsheets, and manual tracking:
- Builder contact and plan receipt (email thread).
- Bid computation in Excel and proposal generation in Word/PDF.
- Bid follow-up and status updates.
- Bid conversion to job/project.
- Scheduling, phase execution, work orders, inspections, invoicing, and warranty.

Primary pain points:
- Data is fragmented across email, text, paper notes, and personal memory.
- Task ownership and follow-up are easy to miss.
- Work order details are lost over time ("we know today, but not a year from now").
- No centralized "single source of truth" for handoffs, sick leave, vacation coverage, and auditing.
- Metrics and actual-vs-estimate reporting are not available in one place.

## Roles and Users
- Owner/lead operations user (workflow oversight, approvals, follow-up, scheduling visibility).
- Estimator / project lead (bid preparation and conversion).
- Scheduler / dispatcher (assigns crews and dates).
- Installers/technicians/engineers (execute work orders and update completion artifacts).
- Back office billing/admin (invoice lifecycle and payment tracking).

## Functional Requirements (Consolidated)

### 1) Customer and Bid Capture
- Create and maintain customer/builder records.
- Store incoming bid requests with source email/plan references.
- Track bid statuses: draft, submitted, follow-up, approved, rejected.
- Keep bid notes and interaction history in one place.
- Support assignment of bid tasks to team members.

### 2) Bid Authoring and Proposal Output
- Preserve spreadsheet-based estimating logic as first system of record.
- Generate proposal document (template-driven) from structured bid data.
- Produce PDF output for sending/uploading to external builder systems.
- Keep DocuSign/PandaDoc as later-phase optional integration.

### 3) Bid-to-Project Conversion
- Convert approved bid into project/job with inherited context.
- Generate project number in date-sequence format (example: `YYMMDD-001`).
- Keep traceability from bid -> project.

### 4) Project Lifecycle and Phases
- Default phase model requested:
  - Rough
  - Trim
  - Start Up
  - Warranty
- Allow per-project and per-work-order additions (for change order scenarios).
- Gate progression by business checkpoints (inspection, invoice/payment, completion artifacts).

### 5) Work Orders and Tasking
- Each project contains multiple work orders.
- Each work order includes:
  - Assignment (technician/engineer)
  - Scheduled date/time
  - Checklist/subtasks
  - Notes
  - Photos/images
  - Material/equipment references
  - Status
- Default task templates should auto-populate; users can add ad hoc tasks.
- Work order completion should trigger invoice readiness state.

### 6) Scheduling and Calendar View
- Calendar-based view of assignments by person/week.
- Visibility into pending and blocked work.
- Support rescheduling and carry-over from missed completions.

### 7) Financial and Operational Tracking
- Track invoice statuses (`pending`, `sent`, `paid`) at work order and/or phase level.
- Enable actual-vs-estimate reporting for labor/material outcomes.
- Integrate with QuickBooks where APIs permit; fallback import/export template mode otherwise.

### 8) Centralized Activity and Audit
- Every significant action should be logged (status changes, assignment, completion, billing).
- Preserve artifacts (documents/photos/checkpoints) under the associated customer/project/work order.
- Avoid person-dependent silos by making current state visible to authorized staff.

## Non-Functional and Platform Constraints
- Authentication: Microsoft standard auth (Entra ID / Azure AD).
- Ecosystem: Microsoft 365 users, Outlook, SharePoint, OneDrive.
- Hosting preference: Azure free-tier aware design initially.
- UX preference: simple, practical web app (App Script-like productivity flow).
- Team preference: color-coded task views for fast prioritization.

## Existing Workbook Insights to Preserve
The workbook contains domain structures that should map into the system:
- Summary costing, margin and direct/indirect cost composition.
- Rough labor, trim labor, gas pipe, materials catalogs.
- Builder information intake sheet.
- Time card structure.
- Optional add-on pricing matrix.

These should inform:
- Bid line-item categories.
- Reusable labor/material templates.
- Standardized work-order checklists per phase.

## MVP Feature Breakdown

### MVP-1: Core CRM + Bid Pipeline
- Customer/Builder management.
- Bid intake, assignment, status tracking, notes.
- Spreadsheet-linked estimating references.
- Proposal PDF generation from template.

### MVP-2: Project + Work Order Operations
- Bid conversion to project/job.
- Default phases with configurable templates.
- Work order creation, assignment, checklist tasks, notes, photo attachments.
- Calendar/schedule board.

### MVP-3: Billing and Phase Gates
- Invoice readiness and invoice status tracking.
- Phase completion gates (inspection + checklist + financial status).
- Baseline operational dashboard (pending, blocked, overdue, completed).

### Post-MVP
- Deep QuickBooks automation (if API access supports desired operations).
- E-signature integrations.
- Advanced metrics and forecasting.
- Expanded procurement integration workflows.

## Spreadsheet-First Data Model (Initial)

### Core Entities
- `Customers`
- `Contacts`
- `Bids`
- `BidLineItems`
- `Projects`
- `ProjectPhases`
- `WorkOrders`
- `WorkOrderTasks`
- `WorkOrderAttachments`
- `Invoices`
- `InvoiceLinks` (work order/phase to invoice mapping)
- `Users`
- `ActivityLog`
- `Lookups`

### Key Relationship Rules
- One `Customer` -> many `Bids` and many `Projects`.
- One approved `Bid` -> one `Project` (initial rule).
- One `Project` -> many `ProjectPhases`.
- One `ProjectPhase` -> many `WorkOrders`.
- One `WorkOrder` -> many `WorkOrderTasks` and `WorkOrderAttachments`.
- One `Invoice` may map to one or many `WorkOrders` based on billing policy.

### ID Conventions
- `CustomerId`: `CUST-000001`
- `BidId`: `BID-YYYYMMDD-001`
- `ProjectId`: `PRJ-YYMMDD-001` (aligned with requested date sequence)
- `WorkOrderId`: `WO-PRJ-###`
- `TaskId`: `TSK-WO-###`
- `InvoiceId`: external QB id or internal `INV-YYYYMMDD-###`

### Required Status Enums (seed)
- Bid: `draft`, `submitted`, `follow_up`, `approved`, `rejected`, `cancelled`
- Project: `active`, `on_hold`, `closed`
- Phase: `not_started`, `ready`, `in_progress`, `blocked`, `inspection_pending`, `complete`
- Work Order: `open`, `assigned`, `in_progress`, `blocked`, `complete`, `invoicing_pending`, `invoiced`, `paid`
- Task: `todo`, `in_progress`, `done`, `blocked`

## Proposed Architecture (Azure + Microsoft 365)
```mermaid
flowchart LR
userStaff[StaffUsers] --> webApp[WebAppUI]
webApp --> auth[EntraIdAuth]
webApp --> api[ApiLayer]
api --> crm[CrmServices]
crm --> sheetRepo[SpreadsheetRepository]
crm --> graph[MicrosoftGraphAdapter]
graph --> outlook[OutlookEmail]
graph --> sharepoint[SharePointOneDrive]
crm --> qb[QuickBooksAdapter]
crm --> files[DocumentAttachmentStore]
```

### Implementation Direction
- Frontend: lightweight web app dashboard with role-aware views.
- API layer: CRUD + workflow endpoints for bids/projects/work orders/tasks.
- Spreadsheet repository: controlled read/write adapter to avoid direct sheet logic in UI.
- Integration adapters:
  - Microsoft Graph (user/task/email/doc links).
  - QuickBooks (initially minimal sync points, graceful fallback).

## Risks and Early Mitigations
- Transcript quality from noisy speech: mitigate with iterative review and corrections in next pass.
- QuickBooks API fit gaps: design fallback template-based export/import.
- Workflow complexity growth: enforce phase/work-order templates early.
- Data quality drift: add required fields, status gates, and audit logging from day one.

## Clarifications to Finalize Before Build Sprint 1
1. Is invoice/payment gate mandatory before moving to the next phase for every project type?
2. Should one invoice map to one work order, one phase, or be configurable per builder/customer?
3. Should tasks sync to Microsoft To Do/Planner in MVP, or remain in-app only for now?
4. Do you want OneDrive/SharePoint file storage from MVP-1, or start with local links and add storage integration in MVP-2?
