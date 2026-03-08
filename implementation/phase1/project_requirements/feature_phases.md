# Feature Phases (MVP -> Post-MVP)

## Phase 1: CRM + Bid Desk (MVP)
Goal: replace fragmented bid intake and follow-up.

Features:
- Customer and builder records.
- Bid intake record with source email/thread reference.
- Bid statuses (`draft`, `submitted`, `follow_up`, `approved`, `rejected`).
- Bid assignment and due-date tracking.
- Bid notes and communication timeline.
- Proposal generation from template to PDF.

Acceptance criteria:
- Team can create and submit bids without leaving the app.
- Every bid has owner, status, and follow-up date.
- Proposal PDF is generated from structured data.

## Phase 2: Project Conversion + Execution (MVP)
Goal: operationalize approved bids into executable work.

Features:
- Convert approved bid -> project/job.
- Auto project numbering (`PRJ-YYMMDD-###`).
- Default lifecycle phases:
  - Rough
  - Trim
  - Start Up
  - Warranty
- Work order creation under each phase.
- Work order assignment (person/date/time).
- Work order subtasks/checklists.
- Work order notes + image attachments.
- Personal task board and schedule/calendar view.

Acceptance criteria:
- Project creation retains bid lineage.
- Users can track each work order through completion.
- Managers can view who is assigned to what and when.

## Phase 3: Billing Gates + Operational Controls (MVP)
Goal: enforce financial and process discipline.

Features:
- Work-order invoice tracking:
  - `invoicing_pending`
  - `invoiced`
  - `paid`
- Strict gating:
  - Next phase cannot advance until related work-order invoices are paid.
- Inspection checkpoints before phase close.
- Blocked state with explicit reason and owner.
- Baseline dashboards:
  - pending tasks
  - blocked work orders
  - overdue assignments
  - phase completion status

Acceptance criteria:
- Phase close blocked unless checklist + inspection + payment rules are met.
- Teams can identify blockers without searching emails/texts.

## Phase 4: Integrations Hardening (Post-MVP)
Goal: reduce duplicate entry and improve external sync.

Features:
- QuickBooks integration depth expansion.
- Microsoft Graph integration hardening (Outlook, OneDrive, SharePoint links).
- Optional e-sign integration (DocuSign/PandaDoc).
- Advanced reporting:
  - actual vs estimate by project/phase/work order
  - labor and material variance trends

Acceptance criteria:
- Reduced manual re-entry between systems.
- Reliable finance and variance reporting for decision making.

## Dependency Order
1. CRM and bid model must exist before project conversion.
2. Project and work-order model must exist before billing gates.
3. Stable internal workflow must exist before deep external integrations.
