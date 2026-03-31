const express = require("express");
const { readWorkbook, writeWorkbook, getSheetRows, replaceSheetRows, nowIso, nextId } = require("./store");

// ── Date-based ID prefix: BID-YYYYMMDD- / PRJ-YYYYMMDD- ──
function datePrefix(type) {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${type}-${y}${m}${day}-`;
}

function createApi() {
  const router = express.Router();

  router.get("/health", (_req, res) => res.json({ ok: true, at: nowIso() }));

  // ── Users ──
  router.get("/users", (_req, res) => {
    const wb = readWorkbook();
    const truthy = v => v === true || v === 1 || String(v).toLowerCase() === "true" || String(v) === "1";
    const all = getSheetRows(wb, "Users");
    const filtered = all.filter(u => truthy(u.IsAssignable) && truthy(u.IsActiveUser));
    res.json(filtered.length ? filtered : all);
  });

  // ── Customers ──
  router.get("/customers", (_req, res) => {
    const wb = readWorkbook();
    res.json(getSheetRows(wb, "Customers"));
  });

  // ── Bids ──
  router.get("/bids", (_req, res) => {
    const wb = readWorkbook();
    res.json(getSheetRows(wb, "Bids"));
  });

  router.post("/bids", (req, res) => {
    const wb = readWorkbook();
    const rows = getSheetRows(wb, "Bids");
    const bid = {
      BidId: nextId(datePrefix("BID"), rows, "BidId"),
      BidNumber: `${datePrefix("BID")}${Date.now()}`,
      CustomerId: req.body.CustomerId || "",
      BidTitle: req.body.BidTitle || "New Bid",
      BidOwnerUserId: req.body.BidOwnerUserId || "",
      EstimatorUserId: req.body.EstimatorUserId || "",
      BidStatus: "draft",
      RequestReceivedDate: nowIso().slice(0, 10),
      DueDate: req.body.DueDate || "",
      SubmittedDate: "",
      ApprovedDate: "",
      TotalEstimatedAmount: req.body.TotalEstimatedAmount || "",
      Notes: req.body.Notes || ""
    };
    rows.push(bid);
    replaceSheetRows(wb, "Bids", rows);
    writeWorkbook(wb);
    res.status(201).json(bid);
  });

  router.put("/bids/:bidId", (req, res) => {
    const wb = readWorkbook();
    const rows = getSheetRows(wb, "Bids");
    const row = rows.find(r => r.BidId === req.params.bidId);
    if (!row) return res.status(404).json({ error: "Bid not found" });

    ["CustomerId","BidTitle","BidOwnerUserId","EstimatorUserId","BidStatus",
     "RequestReceivedDate","DueDate","SubmittedDate","ApprovedDate","TotalEstimatedAmount","Notes"]
      .forEach(k => { if (req.body[k] !== undefined) row[k] = req.body[k]; });
    replaceSheetRows(wb, "Bids", rows);

    // ── Sync assignment: title, assignee, due date, status ──
    const assignments = getSheetRows(wb, "Assignments");
    const estimator = row.EstimatorUserId;
    const isClosedStatus = ["approved","rejected"].includes(row.BidStatus);

    const existing = assignments.find(
      a => a.EntityType === "bid" && a.EntityId === row.BidId && a.TaskStatus !== "done"
    );

    if (existing) {
      existing.TaskTitle    = `Complete bid and submit: ${row.BidTitle}`;
      existing.AssignedUserId = estimator || existing.AssignedUserId;
      existing.DueDate      = row.DueDate || existing.DueDate;
      if (isClosedStatus) {
        existing.TaskStatus     = "done";
        existing.CompletedAtUtc = nowIso();
      } else {
        existing.TaskStatus = "assigned";
      }
      replaceSheetRows(wb, "Assignments", assignments);
    } else if (estimator && !isClosedStatus) {
      assignments.push({
        AssignmentId:     nextId("ASG-", assignments, "AssignmentId"),
        EntityType:       "bid",
        EntityId:         row.BidId,
        TaskTitle:        `Complete bid and submit: ${row.BidTitle}`,
        AssignedUserId:   estimator,
        AssignedRole:     "estimator",
        TaskStatus:       "assigned",
        AssignedAtUtc:    nowIso(),
        DueDate:          row.DueDate || "",
        CompletedAtUtc:   "",
        CompletionEffect: "Set BidStatus=submitted",
        Priority:         "medium",
        Notes:            ""
      });
      replaceSheetRows(wb, "Assignments", assignments);
    }

    writeWorkbook(wb);
    res.json(row);
  });

  router.post("/bids/:bidId/assign", (req, res) => {
    const wb = readWorkbook();
    const bids = getSheetRows(wb, "Bids");
    const assignments = getSheetRows(wb, "Assignments");
    const bid = bids.find(b => b.BidId === req.params.bidId);
    if (bid && bid.BidStatus === "draft") { bid.BidStatus = "assigned"; replaceSheetRows(wb, "Bids", bids); }

    const existing = assignments.find(
      a => a.EntityType === "bid" && a.EntityId === req.params.bidId && a.TaskStatus !== "done"
    );
    if (existing) {
      existing.AssignedUserId = req.body.AssignedUserId || existing.AssignedUserId;
      existing.DueDate = req.body.DueDate || existing.DueDate;
      existing.Priority = req.body.Priority || existing.Priority;
      existing.Notes = req.body.Notes || existing.Notes;
      replaceSheetRows(wb, "Assignments", assignments);
      writeWorkbook(wb);
      return res.status(200).json(existing);
    }

    const task = {
      AssignmentId: nextId("ASG-", assignments, "AssignmentId"),
      EntityType: "bid", EntityId: req.params.bidId,
      TaskTitle: req.body.TaskTitle || "Complete bid and submit",
      AssignedUserId: req.body.AssignedUserId || "",
      AssignedRole: req.body.AssignedRole || "estimator",
      TaskStatus: "assigned", AssignedAtUtc: nowIso(),
      DueDate: req.body.DueDate || "", CompletedAtUtc: "",
      CompletionEffect: "Set BidStatus=submitted",
      Priority: req.body.Priority || "medium", Notes: req.body.Notes || ""
    };
    assignments.push(task);
    replaceSheetRows(wb, "Assignments", assignments);
    writeWorkbook(wb);
    res.status(201).json(task);
  });

  router.post("/bids/:bidId/convert-to-project", (req, res) => {
    const wb = readWorkbook();
    const bids = getSheetRows(wb, "Bids");
    const projects = getSheetRows(wb, "Projects");
    const phases = getSheetRows(wb, "ProjectPhases");
    const workOrders = getSheetRows(wb, "WorkOrders");
    const assignments = getSheetRows(wb, "Assignments"); // ── LOAD ASSIGNMENTS ──
    const bid = bids.find(b => b.BidId === req.params.bidId);
    if (!bid) return res.status(404).json({ error: "Bid not found" });

    const projectId = nextId(datePrefix("PRJ"), projects, "ProjectId");
    const startDate = req.body.StartDate || nowIso().slice(0, 10);
    const managerId = req.body.ProjectManagerUserId || bid.BidOwnerUserId || "";

    const project = {
      ProjectId: projectId, ProjectNumber: `${datePrefix("PRJ")}${Date.now()}`,
      BidId: bid.BidId, CustomerId: bid.CustomerId,
      ProjectName: bid.BidTitle || "Converted Project",
      ProjectStatus: "active", StartDate: startDate,
      TargetCompletionDate: req.body.TargetCompletionDate || "",
      ProjectManagerUserId: managerId,
      Notes: `Converted from bid ${bid.BidId}`
    };
    projects.push(project);

    const phaseList = [
      { code: "rough", label: "Rough In" }, { code: "trim", label: "Trim" },
      { code: "startup", label: "Startup" }, { code: "warranty", label: "Warranty" }
    ];
    const createdPhases = [], createdWorkOrders = [];

    phaseList.forEach(({ code, label }, idx) => {
      const phase = {
        ProjectPhaseId: nextId("PP-", phases, "ProjectPhaseId"),
        ProjectId: projectId, PhaseCode: code, SequenceNo: idx + 1,
        PhaseStatus: idx === 0 ? "in_progress" : "locked",
        StartDate: idx === 0 ? startDate : "", TargetDate: "", CompletedDate: "",
        BlockedReason: idx > 0 ? "Waiting for previous phase" : ""
      };
      phases.push(phase);
      createdPhases.push(phase);

      const wo = {
        WorkOrderId: nextId("WO-", workOrders, "WorkOrderId"),
        ProjectId: projectId, ProjectPhaseId: phase.ProjectPhaseId,
        WorkOrderType: "standard", Title: `${label} - Default Work Order`,
        AssignedUserId: managerId, InstallerUserId: managerId,
        WorkOrderStatus: "open", ScheduledStart: "", ScheduledEnd: "",
        ActualStart: "", ActualEnd: "",
        InspectionStatus: "pending", InvoiceStatus: "pending",
        Notes: `Auto-created for ${label} phase`
      };
      workOrders.push(wo);
      createdWorkOrders.push(wo);

      // ── CREATE ASSIGNMENT (TASK) FOR EACH DEFAULT WORK ORDER ──
      assignments.push({
        AssignmentId:     nextId("ASG-", assignments, "AssignmentId"),
        EntityType:       "work_order",
        EntityId:         wo.WorkOrderId,
        TaskTitle:        `Execute: ${wo.Title}`,
        AssignedUserId:   managerId,
        AssignedRole:     "installer",
        TaskStatus:       "assigned",
        AssignedAtUtc:    nowIso(),
        DueDate:          "",
        CompletedAtUtc:   "",
        CompletionEffect: "Set WorkOrderStatus=complete",
        Priority:         "high",
        Notes:            wo.Notes || ""
      });
    });

    bid.BidStatus = "approved";
    bid.ApprovedDate = nowIso().slice(0, 10);
    replaceSheetRows(wb, "Bids", bids);
    replaceSheetRows(wb, "Projects", projects);
    replaceSheetRows(wb, "ProjectPhases", phases);
    replaceSheetRows(wb, "WorkOrders", workOrders);
    replaceSheetRows(wb, "Assignments", assignments); // ── SAVE ASSIGNMENTS ──
    writeWorkbook(wb);
    res.status(201).json({ project, phases: createdPhases, workOrders: createdWorkOrders });
  });

  // ── Projects ──
  router.get("/projects", (_req, res) => {
    const wb = readWorkbook();
    res.json(getSheetRows(wb, "Projects"));
  });

  router.put("/projects/:projectId", (req, res) => {
    const wb = readWorkbook();
    const rows = getSheetRows(wb, "Projects");
    const row = rows.find(r => r.ProjectId === req.params.projectId);
    if (!row) return res.status(404).json({ error: "Project not found" });
    ["CustomerId","ProjectName","ProjectStatus","StartDate","TargetCompletionDate","ProjectManagerUserId","Notes"]
      .forEach(k => { if (req.body[k] !== undefined) row[k] = req.body[k]; });
    replaceSheetRows(wb, "Projects", rows);
    writeWorkbook(wb);
    res.json(row);
  });

  // ── Phases ──
  router.get("/phases", (req, res) => {
    const wb = readWorkbook();
    let rows = getSheetRows(wb, "ProjectPhases");
    if (req.query.projectId) rows = rows.filter(p => p.ProjectId === req.query.projectId);
    res.json(rows);
  });

  router.put("/phases/:phaseId", (req, res) => {
    const wb = readWorkbook();
    const rows = getSheetRows(wb, "ProjectPhases");
    const row = rows.find(r => r.ProjectPhaseId === req.params.phaseId);
    if (!row) return res.status(404).json({ error: "Phase not found" });
    ["PhaseStatus","StartDate","TargetDate","CompletedDate","BlockedReason"]
      .forEach(k => { if (req.body[k] !== undefined) row[k] = req.body[k]; });
    replaceSheetRows(wb, "ProjectPhases", rows);
    writeWorkbook(wb);
    res.json(row);
  });

  // ── BidTasks ──
  router.get("/bid-tasks", (req, res) => {
    const wb = readWorkbook();
    let rows = getSheetRows(wb, "BidTasks");
    if (req.query.bidId) rows = rows.filter(t => t.BidId === req.query.bidId);
    res.json(rows);
  });

  router.post("/bid-tasks", (req, res) => {
    const wb = readWorkbook();
    const rows = getSheetRows(wb, "BidTasks");
    const task = {
      BidTaskId:     nextId("BT-", rows, "BidTaskId"),
      BidId:         req.body.BidId || "",
      TaskName:      req.body.TaskName || "New Task",
      AssignedUserId: req.body.AssignedUserId || "",
      TaskStatus:    req.body.TaskStatus || "todo",
      DueDate:       req.body.DueDate || "",
      CompletedDate: "",
      Priority:      req.body.Priority || "medium",
      Notes:         req.body.Notes || ""
    };
    rows.push(task);
    replaceSheetRows(wb, "BidTasks", rows);

    // ── Create matching Assignment ──
    if (task.AssignedUserId) {
      const assignments = getSheetRows(wb, "Assignments");
      assignments.push({
        AssignmentId:     nextId("ASG-", assignments, "AssignmentId"),
        EntityType:       "bid_task",
        EntityId:         task.BidTaskId,
        TaskTitle:        task.TaskName,
        AssignedUserId:   task.AssignedUserId,
        AssignedRole:     "general",
        TaskStatus:       task.TaskStatus === "done" ? "done" : "assigned",
        AssignedAtUtc:    nowIso(),
        DueDate:          task.DueDate || "",
        CompletedAtUtc:   "",
        CompletionEffect: "",
        Priority:         task.Priority || "medium",
        Notes:            task.Notes || ""
      });
      replaceSheetRows(wb, "Assignments", assignments);
    }

    writeWorkbook(wb);
    res.status(201).json(task);
  });

  router.put("/bid-tasks/:taskId", (req, res) => {
    const wb = readWorkbook();
    const rows = getSheetRows(wb, "BidTasks");
    const row = rows.find(r => r.BidTaskId === req.params.taskId);
    if (!row) return res.status(404).json({ error: "BidTask not found" });

    ["TaskName","AssignedUserId","TaskStatus","DueDate","CompletedDate","Priority","Notes"]
      .forEach(k => { if (req.body[k] !== undefined) row[k] = req.body[k]; });
    replaceSheetRows(wb, "BidTasks", rows);

    // ── Sync Assignment ──
    const assignments = getSheetRows(wb, "Assignments");
    const isDone = row.TaskStatus === "done";

    const existing = assignments.find(
      a => a.EntityType === "bid_task" && a.EntityId === row.BidTaskId && a.TaskStatus !== "done"
    );

    if (existing) {
      existing.TaskTitle      = row.TaskName;
      existing.AssignedUserId = row.AssignedUserId || existing.AssignedUserId;
      existing.DueDate        = row.DueDate || existing.DueDate;
      existing.Priority       = row.Priority || existing.Priority;
      if (isDone) {
        existing.TaskStatus     = "done";
        existing.CompletedAtUtc = row.CompletedDate ? row.CompletedDate : nowIso();
      } else {
        existing.TaskStatus = "assigned";
      }
      replaceSheetRows(wb, "Assignments", assignments);
    } else if (row.AssignedUserId && !isDone) {
      assignments.push({
        AssignmentId:     nextId("ASG-", assignments, "AssignmentId"),
        EntityType:       "bid_task",
        EntityId:         row.BidTaskId,
        TaskTitle:        row.TaskName,
        AssignedUserId:   row.AssignedUserId,
        AssignedRole:     "general",
        TaskStatus:       "assigned",
        AssignedAtUtc:    nowIso(),
        DueDate:          row.DueDate || "",
        CompletedAtUtc:   "",
        CompletionEffect: "",
        Priority:         row.Priority || "medium",
        Notes:            row.Notes || ""
      });
      replaceSheetRows(wb, "Assignments", assignments);
    }

    writeWorkbook(wb);
    res.json(row);
  });

  router.post("/bid-tasks/:taskId/complete", (req, res) => {
    const wb = readWorkbook();
    const rows = getSheetRows(wb, "BidTasks");
    const row = rows.find(r => r.BidTaskId === req.params.taskId);
    if (!row) return res.status(404).json({ error: "BidTask not found" });

    row.TaskStatus    = "done";
    row.CompletedDate = nowIso().slice(0, 10);
    replaceSheetRows(wb, "BidTasks", rows);

    // ── Mark matching Assignment done ──
    const assignments = getSheetRows(wb, "Assignments");
    const existing = assignments.find(
      a => a.EntityType === "bid_task" && a.EntityId === row.BidTaskId && a.TaskStatus !== "done"
    );
    if (existing) {
      existing.TaskStatus     = "done";
      existing.CompletedAtUtc = nowIso();
      replaceSheetRows(wb, "Assignments", assignments);
    }

    writeWorkbook(wb);
    res.json(row);
  });

  // ── Work Orders ──
  router.get("/work-orders", (req, res) => {
    const wb = readWorkbook();
    let rows = getSheetRows(wb, "WorkOrders");
    if (req.query.projectId) rows = rows.filter(r => r.ProjectId === req.query.projectId);
    if (req.query.phaseId) rows = rows.filter(r => r.ProjectPhaseId === req.query.phaseId);
    res.json(rows);
  });

  router.post("/work-orders", (req, res) => {
    const wb = readWorkbook();
    const rows = getSheetRows(wb, "WorkOrders");
    const wo = {
      WorkOrderId: nextId("WO-", rows, "WorkOrderId"),
      ProjectId: req.body.ProjectId || "",
      ProjectPhaseId: req.body.ProjectPhaseId || "",
      WorkOrderType: req.body.WorkOrderType || "standard",
      Title: req.body.Title || "New Work Order",
      AssignedUserId: req.body.AssignedUserId || "",
      InstallerUserId: req.body.InstallerUserId || req.body.AssignedUserId || "",
      WorkOrderStatus: req.body.WorkOrderStatus || "open",
      ScheduledStart: req.body.ScheduledStart || "",
      ScheduledEnd: req.body.ScheduledEnd || "",
      ActualStart: "", ActualEnd: "",
      InspectionStatus: req.body.InspectionStatus || "pending",
      InvoiceStatus: req.body.InvoiceStatus || "pending",
      Notes: req.body.Notes || ""
    };
    rows.push(wo);
    replaceSheetRows(wb, "WorkOrders", rows);

    // ── Create assignment for installer ──
    if (wo.InstallerUserId) {
      const assignments = getSheetRows(wb, "Assignments");
      assignments.push({
        AssignmentId: nextId("ASG-", assignments, "AssignmentId"),
        EntityType: "work_order",
        EntityId: wo.WorkOrderId,
        TaskTitle: `Execute: ${wo.Title}`,
        AssignedUserId: wo.InstallerUserId,
        AssignedRole: "installer",
        TaskStatus: "assigned",
        AssignedAtUtc: nowIso(),
        DueDate: wo.ScheduledEnd ? wo.ScheduledEnd.slice(0, 10) : "",
        CompletedAtUtc: "",
        CompletionEffect: "Set WorkOrderStatus=complete",
        Priority: "high",
        Notes: wo.Notes || ""
      });
      replaceSheetRows(wb, "Assignments", assignments);
    }

    writeWorkbook(wb);
    res.status(201).json(wo);
  });

  router.put("/work-orders/:workOrderId", (req, res) => {
    const wb = readWorkbook();
    const rows = getSheetRows(wb, "WorkOrders");
    const phases = getSheetRows(wb, "ProjectPhases");
    const row = rows.find(r => r.WorkOrderId === req.params.workOrderId);
    if (!row) return res.status(404).json({ error: "Work order not found" });

    // ── Phase Gate Check ──
    const newStatus = req.body.WorkOrderStatus;
    const lockedStatuses = ["in_progress", "complete"];
    if (newStatus && lockedStatuses.includes(newStatus) && newStatus !== row.WorkOrderStatus) {
      const phase = phases.find(p => p.ProjectPhaseId === row.ProjectPhaseId);
      if (phase && (phase.PhaseStatus === "locked" || phase.PhaseStatus === "not_started")) {
        return res.status(403).json({
          error: `Phase is locked. Complete all work orders and pass all inspections in the previous phase first.`,
          code: "PHASE_LOCKED"
        });
      }
    }

    ["WorkOrderType","Title","AssignedUserId","InstallerUserId","WorkOrderStatus",
     "ScheduledStart","ScheduledEnd","ActualStart","ActualEnd",
     "InspectionStatus","InvoiceStatus","Notes"]
      .forEach(k => { if (req.body[k] !== undefined) row[k] = req.body[k]; });
    replaceSheetRows(wb, "WorkOrders", rows);

    // ── Sync assignment ──
    const assignments = getSheetRows(wb, "Assignments");
    const installer   = row.InstallerUserId;
    const isComplete  = row.WorkOrderStatus === "complete";
    const dueDate     = row.ScheduledEnd ? String(row.ScheduledEnd).slice(0, 10) : "";

    const existing = assignments.find(
      a => a.EntityType === "work_order" && a.EntityId === row.WorkOrderId && a.TaskStatus !== "done"
    );

    if (existing) {
      existing.TaskTitle      = `Execute: ${row.Title}`;
      existing.AssignedUserId = installer || existing.AssignedUserId;
      existing.DueDate        = dueDate || existing.DueDate;
      if (isComplete) {
        existing.TaskStatus     = "done";
        existing.CompletedAtUtc = nowIso();
      } else {
        existing.TaskStatus = "assigned";
      }
      replaceSheetRows(wb, "Assignments", assignments);
    } else if (installer && !isComplete) {
      assignments.push({
        AssignmentId:     nextId("ASG-", assignments, "AssignmentId"),
        EntityType:       "work_order",
        EntityId:         row.WorkOrderId,
        TaskTitle:        `Execute: ${row.Title}`,
        AssignedUserId:   installer,
        AssignedRole:     "installer",
        TaskStatus:       "assigned",
        AssignedAtUtc:    nowIso(),
        DueDate:          dueDate,
        CompletedAtUtc:   "",
        CompletionEffect: "Set WorkOrderStatus=complete",
        Priority:         "high",
        Notes:            row.Notes || ""
      });
      replaceSheetRows(wb, "Assignments", assignments);
    }

    // ── Auto-advance phase on completion ──
    const phaseWOs = rows.filter(w => w.ProjectPhaseId === row.ProjectPhaseId);
    const allComplete = phaseWOs.every(w => w.WorkOrderStatus === "complete");
    const allPassed   = phaseWOs.every(w => w.InspectionStatus === "passed");

    if (allComplete && allPassed) {
      const currentPhase = phases.find(p => p.ProjectPhaseId === row.ProjectPhaseId);
      if (currentPhase && currentPhase.PhaseStatus !== "complete") {
        currentPhase.PhaseStatus   = "complete";
        currentPhase.CompletedDate = nowIso().slice(0, 10);

        const phaseOrder = ["rough","trim","startup","warranty"];
        const currentIdx = phaseOrder.indexOf(currentPhase.PhaseCode);
        if (currentIdx !== -1 && currentIdx < phaseOrder.length - 1) {
          const nextCode  = phaseOrder[currentIdx + 1];
          const nextPhase = phases.find(
            p => p.ProjectId === currentPhase.ProjectId && p.PhaseCode === nextCode
          );
          if (nextPhase && (nextPhase.PhaseStatus === "locked" || nextPhase.PhaseStatus === "not_started")) {
            nextPhase.PhaseStatus = "in_progress";
            nextPhase.StartDate   = nowIso().slice(0, 10);
            nextPhase.BlockedReason = "";
          }
        }
        replaceSheetRows(wb, "ProjectPhases", phases);
      }
    }

    writeWorkbook(wb);
    const updatedPhases = getSheetRows(readWorkbook(), "ProjectPhases")
      .filter(p => p.ProjectId === row.ProjectId);
    res.json({ workOrder: row, phases: updatedPhases });
  });

  router.post("/work-orders/:workOrderId/complete", (req, res) => {
    const wb = readWorkbook();
    const rows = getSheetRows(wb, "WorkOrders");
    const row = rows.find(r => r.WorkOrderId === req.params.workOrderId);
    if (!row) return res.status(404).json({ error: "Work order not found" });
    row.WorkOrderStatus = "complete";
    row.ActualEnd = nowIso();
    replaceSheetRows(wb, "WorkOrders", rows);
    writeWorkbook(wb);
    res.json(row);
  });

  // ── Assignments / Tasks ──
  router.get("/my-tasks", (req, res) => {
    const wb = readWorkbook();
    const rows = getSheetRows(wb, "Assignments");
    const userId = req.query.userId;
    const open = rows.filter(a => a.TaskStatus !== "done");
    res.json(userId ? open.filter(a => a.AssignedUserId === userId) : open);
  });

  // ── Create a manual task ──
  router.post("/assignments", (req, res) => {
    const wb = readWorkbook();
    const assignments = getSheetRows(wb, "Assignments");
    const task = {
      AssignmentId: nextId("ASG-", assignments, "AssignmentId"),
      EntityType: req.body.EntityType || "general",
      EntityId: req.body.EntityId || "",
      TaskTitle: req.body.TaskTitle || "New Task",
      AssignedUserId: req.body.AssignedUserId || "",
      AssignedRole: req.body.AssignedRole || "general",
      TaskStatus: req.body.TaskStatus || "assigned",
      AssignedAtUtc: nowIso(),
      DueDate: req.body.DueDate || "",
      CompletedAtUtc: "",
      CompletionEffect: req.body.CompletionEffect || "",
      Priority: req.body.Priority || "medium",
      Notes: req.body.Notes || ""
    };
    assignments.push(task);
    replaceSheetRows(wb, "Assignments", assignments);
    writeWorkbook(wb);
    res.status(201).json(task);
  });

  router.post("/assignments/:assignmentId/complete", (req, res) => {
    const wb = readWorkbook();
    const assignments = getSheetRows(wb, "Assignments");
    const bids        = getSheetRows(wb, "Bids");
    const workOrders  = getSheetRows(wb, "WorkOrders");
    const bidTasks    = getSheetRows(wb, "BidTasks");

    const a = assignments.find(x => x.AssignmentId === req.params.assignmentId);
    if (!a) return res.status(404).json({ error: "Assignment not found" });

    a.TaskStatus     = "done";
    a.CompletedAtUtc = nowIso();
    replaceSheetRows(wb, "Assignments", assignments);

    // ── Sync back to source sheet ──
    if (a.EntityType === "bid") {
      const b = bids.find(x => x.BidId === a.EntityId);
      if (b && !["approved","rejected"].includes(b.BidStatus)) {
        b.BidStatus     = "submitted";
        b.SubmittedDate = nowIso().slice(0, 10);
      }
      replaceSheetRows(wb, "Bids", bids);
    }

    if (a.EntityType === "bid_task") {
      const bt = bidTasks.find(x => x.BidTaskId === a.EntityId);
      if (bt) {
        bt.TaskStatus    = "done";
        bt.CompletedDate = nowIso().slice(0, 10);
      }
      replaceSheetRows(wb, "BidTasks", bidTasks);
    }

    if (a.EntityType === "work_order") {
      const w = workOrders.find(x => x.WorkOrderId === a.EntityId);
      if (w) {
        w.WorkOrderStatus = "complete";
        w.ActualEnd       = nowIso();
      }
      replaceSheetRows(wb, "WorkOrders", workOrders);
    }

    writeWorkbook(wb);
    res.json(a);
  });

  // ── Schedule ──
  router.post("/schedule", (req, res) => {
    const wb = readWorkbook();
    const rows = getSheetRows(wb, "Schedule");
    const row = {
      ScheduleId: nextId("SCH-", rows, "ScheduleId"),
      ProjectId: req.body.ProjectId || "",
      WorkOrderId: req.body.WorkOrderId || "",
      AssignedUserId: req.body.AssignedUserId || "",
      ScheduleDate: req.body.ScheduleDate || "",
      StartTime: req.body.StartTime || "",
      EndTime: req.body.EndTime || "",
      ScheduleStatus: req.body.ScheduleStatus || "scheduled",
      Notes: req.body.Notes || ""
    };
    rows.push(row);
    replaceSheetRows(wb, "Schedule", rows);
    writeWorkbook(wb);
    res.status(201).json(row);
  });

  return router;
}

module.exports = { createApi };