// ── State ──
const state = {
  view: "home",
  selectedBid: null, selectedProject: null,
  bids: [], bidTasks: [], projects: [], phases: [],
  workOrders: [], tasks: [], users: [], customers: [],
  taskFilter: "",
};

// ── API ──
async function api(path, options = {}) {
  const res = await fetch(`/api${path}`, { headers: { "Content-Type": "application/json" }, ...options });
  const contentType = res.headers.get("content-type") || "";
  if (!contentType.includes("application/json")) {
    const text = await res.text();
    throw new Error(
      `Server returned non-JSON response for /api${path} (HTTP ${res.status}). ` +
      `Check that Express has the API router mounted and express.json() middleware enabled. ` +
      `Response starts with: ${text.slice(0, 80)}`
    );
  }
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || JSON.stringify(data));
  return data;
}

async function refreshAll() {
  const [bids, bidTasks, projects, phases, workOrders, tasks, users, customers] = await Promise.all([
    api("/bids"), api("/bid-tasks"), api("/projects"), api("/phases"),
    api("/work-orders"), api("/my-tasks"),
    api("/users"), api("/customers")
  ]);
  Object.assign(state, { bids, bidTasks, projects, phases, workOrders, tasks, users, customers });
  if (state.selectedBid) state.selectedBid = state.bids.find(b => b.BidId === state.selectedBid.BidId) || state.selectedBid;
  if (state.selectedProject) state.selectedProject = state.projects.find(p => p.ProjectId === state.selectedProject.ProjectId) || state.selectedProject;
}

// ── Helpers ──
const getCustomerName = id => state.customers.find(c => c.CustomerId === id)?.DisplayName || id;
const getUserName = id => state.users.find(u => u.UserId === id)?.DisplayName || id;

function badge(status) {
  const s = String(status || "").toLowerCase();
  if (["complete","approved","paid","done","passed"].includes(s)) return "badge badge-complete";
  if (["in_progress","assigned","submitted","active","open","invoiced"].includes(s)) return "badge badge-progress";
  if (["blocked","rejected","failed"].includes(s)) return "badge badge-warn";
  return "badge badge-draft";
}

function phaseColor(code) {
  return { rough: "var(--rough)", trim: "var(--trim)", startup: "var(--startup)", warranty: "var(--warranty)" }[code] || "var(--accent)";
}

function dueDateStyle(dueDate) {
  if (!dueDate) return { border: "var(--border)", bg: "transparent", label: "" };
  const today = new Date(); today.setHours(0,0,0,0);
  const due   = new Date(dueDate); due.setHours(0,0,0,0);
  const days  = Math.round((due - today) / 86400000);
  if (days < 0)  return { border: "#dc2626", bg: "rgba(220,38,38,0.06)",  label: `${Math.abs(days)}d overdue` };
  if (days <= 2) return { border: "#c27300", bg: "rgba(194,115,0,0.06)",  label: days === 0 ? "Due today" : `${days}d left` };
  return           { border: "#0f8f4d", bg: "rgba(15,143,77,0.05)",   label: `${days}d left` };
}

// ── Navigation ──
function routeTo(view, data = {}) {
  state.view = view;
  if (data.bid !== undefined) {
    state.selectedBid = typeof data.bid === "string"
      ? (state.bids.find(b => b.BidId === data.bid) || _reg[data.bid])
      : data.bid;
  }
  if (data.project !== undefined) {
    state.selectedProject = typeof data.project === "string"
      ? (state.projects.find(p => p.ProjectId === data.project) || _reg[data.project])
      : data.project;
  }
  render();
}

function updateBreadcrumb() {
  const el = document.getElementById("breadcrumb");
  const crumbs = [{ label: "Home", view: "home" }];
  if (["bids","bid-detail"].includes(state.view)) {
    crumbs.push({ label: "Bids", view: "bids" });
    if (state.view === "bid-detail" && state.selectedBid)
      crumbs.push({ label: state.selectedBid.BidId, view: "bid-detail", active: true });
  }
  if (["projects","project-detail"].includes(state.view)) {
    crumbs.push({ label: "Projects", view: "projects" });
    if (state.view === "project-detail" && state.selectedProject)
      crumbs.push({ label: state.selectedProject.ProjectId, view: "project-detail", active: true });
  }
  if (state.view === "tasks") crumbs.push({ label: "Tasks", view: "tasks", active: true });
  el.innerHTML = crumbs.map((c, i) => `
    ${i > 0 ? '<span class="breadcrumb-sep">›</span>' : ""}
    <span class="breadcrumb-item ${c.active ? "active" : ""}" onclick="routeTo('${c.view}')">${c.label}</span>
  `).join("");

  const navMap = { bids: 0, "bid-detail": 0, projects: 1, "project-detail": 1, tasks: 2 };
  document.querySelectorAll(".nav-item").forEach((el, i) => {
    el.classList.toggle("active", navMap[state.view] === i);
  });
}

// ── Modal ──
function showModal(title, html) {
  const withClose = html.replace(
    /(<div class="btn-row">)([\s\S]*?)(<\/div>)(?![\s\S]*<div class="btn-row">)/,
    `$1$2<button class="btn btn-ghost" onclick="hideModal()">Close</button>$3`
  );
  document.getElementById("modalContent").innerHTML = `<h3>${title}</h3>${withClose}`;
  document.getElementById("modalBackdrop").style.display = "flex";
}
function hideModal() { document.getElementById("modalBackdrop").style.display = "none"; }
document.getElementById("modalBackdrop").addEventListener("click", e => { if (e.target.id === "modalBackdrop") hideModal(); });

// ── HTML escape ──
function h(val) {
  return String(val ?? "")
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

// ── Reusable field builders ──
function userSelect(id, val = "") {
  return `<select id="${id}">${state.users.map(u =>
    `<option value="${h(u.UserId)}" ${u.UserId === val ? "selected" : ""}>${h(u.DisplayName)} (${h(u.Role)})</option>`).join("")}</select>`;
}
function customerSelect(id, val = "") {
  return `<select id="${id}">${state.customers.map(c =>
    `<option value="${h(c.CustomerId)}" ${c.CustomerId === val ? "selected" : ""}>${h(c.DisplayName)}</option>`).join("")}</select>`;
}
function statusSelect(id, options, val = "") {
  return `<select id="${id}">${options.map(o =>
    `<option value="${h(o)}" ${o === val ? "selected" : ""}>${o.replace(/_/g," ")}</option>`).join("")}</select>`;
}
function dateField(id, val = "") {
  const v = val ? String(val).slice(0, 10) : "";
  return `<input id="${id}" type="date" value="${h(v)}"/>`;
}
function textField(id, val = "", placeholder = "") {
  return `<input id="${id}" value="${h(val)}" placeholder="${h(placeholder)}"/>`;
}
function textareaField(id, val = "", placeholder = "") {
  return `<textarea id="${id}" placeholder="${h(placeholder)}">${h(val)}</textarea>`;
}

// ══════════════════════════════════
// ── CREATE BID ──
// ══════════════════════════════════
function openCreateBidModal() {
  showModal("Create New Bid", `
    <div class="field"><label>Customer</label>${customerSelect("mBC")}</div>
    <div class="field"><label>Bid Title</label>${textField("mBT","","e.g. New HVAC Installation")}</div>
    <div class="field"><label>Bid Owner</label>${userSelect("mBO")}</div>
    <div class="field"><label>Estimator</label>${userSelect("mBE")}</div>
    <div class="field"><label>Due Date</label>${dateField("mBD", new Date().toISOString().slice(0,10))}</div>
    <div class="field"><label>Total Estimated Amount</label>${textField("mBA","","e.g. 15000")}</div>
    <div class="field"><label>Notes</label>${textareaField("mBN","","Optional...")}</div>
    <div class="btn-row"><button class="btn btn-primary" onclick="createBid()">Create Bid</button></div>
  `);
}
async function createBid() {
  await api("/bids", { method: "POST", body: JSON.stringify({
    CustomerId: document.getElementById("mBC").value,
    BidTitle: document.getElementById("mBT").value,
    BidOwnerUserId: document.getElementById("mBO").value,
    EstimatorUserId: document.getElementById("mBE").value,
    DueDate: document.getElementById("mBD").value,
    TotalEstimatedAmount: document.getElementById("mBA").value,
    Notes: document.getElementById("mBN").value,
  })});
  hideModal(); await refreshAll(); routeTo("bids");
}

// ══════════════════════════════════
// ── EDIT BID ──
// ══════════════════════════════════
function openEditBidModal(bidOrKey) {
  const bid = typeof bidOrKey === "string"
    ? (state.bids.find(b => b.BidId === bidOrKey) || _reg[bidOrKey])
    : bidOrKey;
  showModal(`Edit Bid — ${bid.BidId}`, `
    <div class="field"><label>Bid Title</label>${textField("eBT", bid.BidTitle)}</div>
    <div class="field"><label>Customer</label>${customerSelect("eBC", bid.CustomerId)}</div>
    <div class="field"><label>Bid Owner</label>${userSelect("eBO", bid.BidOwnerUserId)}</div>
    <div class="field"><label>Estimator</label>${userSelect("eBE", bid.EstimatorUserId)}</div>
    <div class="field"><label>Status</label>${statusSelect("eBS", ["draft","assigned","submitted","approved","rejected"], bid.BidStatus)}</div>
    <div class="field"><label>Request Received Date</label>${dateField("eBRR", bid.RequestReceivedDate)}</div>
    <div class="field"><label>Due Date</label>${dateField("eBD", bid.DueDate)}</div>
    <div class="field"><label>Submitted Date</label>${dateField("eBSD", bid.SubmittedDate)}</div>
    <div class="field"><label>Approved Date</label>${dateField("eBAD", bid.ApprovedDate)}</div>
    <div class="field"><label>Total Estimated Amount</label>${textField("eBA", bid.TotalEstimatedAmount)}</div>
    <div class="field"><label>Notes</label>${textareaField("eBN", bid.Notes)}</div>
    <div class="btn-row"><button class="btn btn-primary" onclick="saveBid('${bid.BidId}')">💾 Save Changes</button></div>
  `);
}
async function saveBid(bidId) {
  try {
    const updated = await api(`/bids/${bidId}`, { method: "PUT", body: JSON.stringify({
      BidTitle: document.getElementById("eBT").value,
      CustomerId: document.getElementById("eBC").value,
      BidOwnerUserId: document.getElementById("eBO").value,
      EstimatorUserId: document.getElementById("eBE").value,
      BidStatus: document.getElementById("eBS").value,
      RequestReceivedDate: document.getElementById("eBRR").value,
      DueDate: document.getElementById("eBD").value,
      SubmittedDate: document.getElementById("eBSD").value,
      ApprovedDate: document.getElementById("eBAD").value,
      TotalEstimatedAmount: document.getElementById("eBA").value,
      Notes: document.getElementById("eBN").value,
    })});
    hideModal(); await refreshAll();
    state.selectedBid = state.bids.find(b => b.BidId === bidId) || updated;
    render();
  } catch(err) { alert("Save failed: " + err.message); }
}

// ══════════════════════════════════
// ── ADD / EDIT BID TASK ──
// ══════════════════════════════════
function openAddBidTaskModal() {
  showModal(`Add Task to ${state.selectedBid.BidId}`, `
    <div class="field"><label>Task Name</label>${textField("mTN","","e.g. Complete quantity takeoff")}</div>
    <div class="field"><label>Assigned To</label>${userSelect("mTU")}</div>
    <div class="field"><label>Status</label>${statusSelect("mTS",["todo","in_progress","assigned","done"])}</div>
    <div class="field"><label>Priority</label>${statusSelect("mTP",["high","medium","low"],"medium")}</div>
    <div class="field"><label>Due Date</label>${dateField("mTD", new Date().toISOString().slice(0,10))}</div>
    <div class="field"><label>Notes</label>${textareaField("mTNo","","Optional...")}</div>
    <div class="btn-row"><button class="btn btn-primary" onclick="addBidTask()">+ Add Task</button></div>
  `);
}
async function addBidTask() {
  await api("/bid-tasks", { method: "POST", body: JSON.stringify({
    BidId: state.selectedBid.BidId,
    TaskName: document.getElementById("mTN").value,
    AssignedUserId: document.getElementById("mTU").value,
    TaskStatus: document.getElementById("mTS").value,
    Priority: document.getElementById("mTP").value,
    DueDate: document.getElementById("mTD").value,
    Notes: document.getElementById("mTNo").value,
  })});
  hideModal(); await refreshAll(); render();
}

function openEditBidTaskModal(taskOrKey) {
  const task = typeof taskOrKey === "string"
    ? (state.bidTasks.find(t => t.BidTaskId === taskOrKey) || _reg[taskOrKey])
    : taskOrKey;
  showModal(`Edit Task — ${task.BidTaskId}`, `
    <div class="field"><label>Task Name</label>${textField("eTN", task.TaskName)}</div>
    <div class="field"><label>Assigned To</label>${userSelect("eTU", task.AssignedUserId)}</div>
    <div class="field"><label>Status</label>${statusSelect("eTS",["todo","in_progress","assigned","done"], task.TaskStatus)}</div>
    <div class="field"><label>Priority</label>${statusSelect("eTP",["high","medium","low"], task.Priority)}</div>
    <div class="field"><label>Due Date</label>${dateField("eTD", task.DueDate)}</div>
    <div class="field"><label>Completed Date</label>${dateField("eTCD", task.CompletedDate)}</div>
    <div class="field"><label>Notes</label>${textareaField("eTNo", task.Notes)}</div>
    <div class="btn-row"><button class="btn btn-primary" onclick="saveBidTask('${task.BidTaskId}')">💾 Save Changes</button></div>
  `);
}
async function saveBidTask(taskId) {
  try {
    await api(`/bid-tasks/${taskId}`, { method: "PUT", body: JSON.stringify({
      TaskName: document.getElementById("eTN").value,
      AssignedUserId: document.getElementById("eTU").value,
      TaskStatus: document.getElementById("eTS").value,
      Priority: document.getElementById("eTP").value,
      DueDate: document.getElementById("eTD").value,
      CompletedDate: document.getElementById("eTCD").value,
      Notes: document.getElementById("eTNo").value,
    })});
    hideModal(); await refreshAll(); render();
  } catch(err) { alert("Save failed: " + err.message); }
}

async function completeBidTask(id) {
  await api(`/bid-tasks/${id}/complete`, { method: "POST" });
  await refreshAll(); render();
}

// ══════════════════════════════════
// ── CONVERT BID → PROJECT ──
// ══════════════════════════════════
function openConvertModal() {
  const bid = state.selectedBid;
  const tasks = state.bidTasks.filter(t => t.BidId === bid.BidId);
  showModal("Convert to Project", `
    <div class="info-box">
      <p><strong>Bid:</strong> ${bid.BidTitle}</p>
      <p><strong>Bid Tasks:</strong> ${tasks.length} linked</p>
      <p style="margin-top:8px"><strong>Will auto-create:</strong></p>
      <p>• 4 Phases: Rough → Trim → Startup → Warranty</p>
      <p>• 1 Default Work Order per phase (4 total)</p>
      <p>• 1 Task (Assignment) per Work Order (4 total)</p>
    </div>
    <div class="field"><label>Project Manager</label>${userSelect("mPM")}</div>
    <div class="field"><label>Start Date</label>${dateField("mPS", new Date().toISOString().slice(0,10))}</div>
    <div class="field"><label>Target Completion</label>${dateField("mPT")}</div>
    <div class="btn-row"><button class="btn btn-primary" onclick="convertToProject()">Convert to Project →</button></div>
  `);
}
async function convertToProject() {
  const result = await api(`/bids/${state.selectedBid.BidId}/convert-to-project`, { method: "POST", body: JSON.stringify({
    ProjectManagerUserId: document.getElementById("mPM").value,
    StartDate: document.getElementById("mPS").value,
    TargetCompletionDate: document.getElementById("mPT").value,
  })});
  hideModal(); await refreshAll();
  const proj = state.projects.find(p => p.ProjectId === result.project.ProjectId) || result.project;
  routeTo("project-detail", { project: proj });
}

// ══════════════════════════════════
// ── EDIT PROJECT ──
// ══════════════════════════════════
function openEditProjectModal(projOrKey) {
  const project = typeof projOrKey === "string"
    ? (state.projects.find(p => p.ProjectId === projOrKey) || _reg[projOrKey])
    : projOrKey;
  showModal(`Edit Project — ${project.ProjectId}`, `
    <div class="field"><label>Project Name</label>${textField("ePPN", project.ProjectName)}</div>
    <div class="field"><label>Customer</label>${customerSelect("ePC", project.CustomerId)}</div>
    <div class="field"><label>Project Manager</label>${userSelect("ePM", project.ProjectManagerUserId)}</div>
    <div class="field"><label>Status</label>${statusSelect("ePS",["active","on_hold","complete","cancelled"], project.ProjectStatus)}</div>
    <div class="field"><label>Start Date</label>${dateField("ePSD", project.StartDate)}</div>
    <div class="field"><label>Target Completion Date</label>${dateField("ePTC", project.TargetCompletionDate)}</div>
    <div class="field"><label>Notes</label>${textareaField("ePNotes", project.Notes)}</div>
    <div class="btn-row"><button class="btn btn-primary" onclick="saveProject('${project.ProjectId}')">💾 Save Changes</button></div>
  `);
}
async function saveProject(projectId) {
  try {
    const updated = await api(`/projects/${projectId}`, { method: "PUT", body: JSON.stringify({
      ProjectName: document.getElementById("ePPN").value,
      CustomerId: document.getElementById("ePC").value,
      ProjectManagerUserId: document.getElementById("ePM").value,
      ProjectStatus: document.getElementById("ePS").value,
      StartDate: document.getElementById("ePSD").value,
      TargetCompletionDate: document.getElementById("ePTC").value,
      Notes: document.getElementById("ePNotes").value,
    })});
    hideModal(); await refreshAll();
    state.selectedProject = state.projects.find(p => p.ProjectId === projectId) || updated;
    render();
  } catch(err) { alert("Save failed: " + err.message); }
}

// ══════════════════════════════════
// ── EDIT PHASE ──
// ── FIX: always pass phaseId string, look up fresh from state ──
// ══════════════════════════════════
function openEditPhaseModal(phaseId) {
  const phase = state.phases.find(p => p.ProjectPhaseId === phaseId);
  if (!phase) { alert("Phase not found: " + phaseId); return; }

  showModal(`Edit Phase — ${phase.PhaseCode.toUpperCase()} (${phase.ProjectPhaseId})`, `
    <input type="hidden" id="ePhId" value="${h(phase.ProjectPhaseId)}">
    <div class="field"><label>Phase Status</label>${statusSelect("ePhs",["not_started","in_progress","complete","blocked","locked"], phase.PhaseStatus)}</div>
    <div class="field"><label>Start Date</label>${dateField("ePhSD", phase.StartDate)}</div>
    <div class="field"><label>Target Date</label>${dateField("ePhTD", phase.TargetDate)}</div>
    <div class="field"><label>Completed Date</label>${dateField("ePhCD", phase.CompletedDate)}</div>
    <div class="field"><label>Blocked Reason</label>${textareaField("ePhBR", phase.BlockedReason, "Reason if blocked...")}</div>
    <div class="btn-row"><button class="btn btn-primary" onclick="savePhase()">💾 Save Changes</button></div>
  `);
}
async function savePhase() {
  const phaseId = document.getElementById("ePhId")?.value;
  if (!phaseId) { alert("Phase ID missing — cannot save."); return; }
  try {
    await api(`/phases/${phaseId}`, { method: "PUT", body: JSON.stringify({
      PhaseStatus: document.getElementById("ePhs").value,
      StartDate: document.getElementById("ePhSD").value,
      TargetDate: document.getElementById("ePhTD").value,
      CompletedDate: document.getElementById("ePhCD").value,
      BlockedReason: document.getElementById("ePhBR").value,
    })});
    hideModal(); await refreshAll(); render();
  } catch(err) { alert("Save failed: " + err.message); }
}

// ══════════════════════════════════
// ── ADD / EDIT WORK ORDER ──
// ══════════════════════════════════
function openAddWorkOrderModal(phaseId) {
  const phase = state.phases.find(p => p.ProjectPhaseId === phaseId);
  showModal(`Add Work Order — ${phase?.PhaseCode?.toUpperCase()} Phase`, `
    <div class="field"><label>Title</label>${textField("mWT","","e.g. Rough in - Duct Installation")}</div>
    <div class="field"><label>Type</label>${statusSelect("mWTy",["standard","change_order","warranty","inspection"],"standard")}</div>
    <div class="field"><label>Assigned To</label>${userSelect("mWA")}</div>
    <div class="field"><label>Installer</label>${userSelect("mWI")}</div>
    <div class="field"><label>Status</label>${statusSelect("mWS",["open","assigned","in_progress","complete"],"open")}</div>
    <div class="field"><label>Scheduled Start</label><input id="mWSt" type="datetime-local"/></div>
    <div class="field"><label>Scheduled End</label><input id="mWEn" type="datetime-local"/></div>
    <div class="field"><label>Inspection Status</label>${statusSelect("mWIn",["pending","passed","failed"],"pending")}</div>
    <div class="field"><label>Invoice Status</label>${statusSelect("mWInv",["pending","invoiced","paid"],"pending")}</div>
    <div class="field"><label>Notes</label>${textareaField("mWN","","Optional...")}</div>
    <div class="btn-row"><button class="btn btn-primary" onclick="addWorkOrder('${phaseId}')">+ Add Work Order</button></div>
  `);
}
async function addWorkOrder(phaseId) {
  await api("/work-orders", { method: "POST", body: JSON.stringify({
    ProjectId: state.selectedProject.ProjectId,
    ProjectPhaseId: phaseId,
    Title: document.getElementById("mWT").value,
    WorkOrderType: document.getElementById("mWTy").value,
    AssignedUserId: document.getElementById("mWA").value,
    InstallerUserId: document.getElementById("mWI").value,
    WorkOrderStatus: document.getElementById("mWS").value,
    ScheduledStart: document.getElementById("mWSt").value,
    ScheduledEnd: document.getElementById("mWEn").value,
    InspectionStatus: document.getElementById("mWIn").value,
    InvoiceStatus: document.getElementById("mWInv").value,
    Notes: document.getElementById("mWN").value,
  })});
  hideModal(); await refreshAll(); render();
}

function openEditWorkOrderModal(woId) {
  // Always look up fresh from state
  const wo = state.workOrders.find(w => w.WorkOrderId === woId);
  if (!wo) { alert("Work Order not found"); return; }

  const phase = state.phases.find(p => p.ProjectPhaseId === wo.ProjectPhaseId);
  // ── FIX: treat both "locked" AND "not_started" as locked ──
  const phaseLocked = phase && (phase.PhaseStatus === "locked" || phase.PhaseStatus === "not_started");

  if (phaseLocked) {
    const phaseOrder = ["rough","trim","startup","warranty"];
    const idx = phaseOrder.indexOf(phase.PhaseCode);
    const prevCode = idx > 0 ? phaseOrder[idx - 1].toUpperCase() : "";
    const fmtDt = v => v ? String(v).slice(0,16).replace("T"," ") : "-";
    showModal(`🔒 Work Order Locked — ${h(wo.WorkOrderId)}`, `
      <div style="background:#fff4dd;border:1px solid #f0c060;border-radius:10px;padding:16px;margin-bottom:16px;font-size:13px">
        <div style="font-size:15px;font-weight:700;margin-bottom:6px">🔒 This phase is locked</div>
        <div style="color:var(--muted)">
          The <strong>${phase.PhaseCode.toUpperCase()}</strong> phase is not active yet.
          Complete all work orders and pass all inspections in the
          <strong>${prevCode}</strong> phase — this phase will unlock automatically.
        </div>
      </div>
      <div style="background:var(--surface2);border:1px solid var(--border);border-radius:10px;padding:16px;font-size:13px">
        <div style="font-size:11px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:12px">Work Order Details (read only)</div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
          <div><span style="font-size:11px;color:var(--muted)">TITLE</span><br><strong>${h(wo.Title)}</strong></div>
          <div><span style="font-size:11px;color:var(--muted)">TYPE</span><br><strong>${wo.WorkOrderType||"-"}</strong></div>
          <div><span style="font-size:11px;color:var(--muted)">ASSIGNED TO</span><br><strong>${getUserName(wo.AssignedUserId)}</strong></div>
          <div><span style="font-size:11px;color:var(--muted)">INSTALLER</span><br><strong>${getUserName(wo.InstallerUserId)}</strong></div>
          <div><span style="font-size:11px;color:var(--muted)">SCHED. START</span><br><strong>${fmtDt(wo.ScheduledStart)}</strong></div>
          <div><span style="font-size:11px;color:var(--muted)">SCHED. END</span><br><strong>${fmtDt(wo.ScheduledEnd)}</strong></div>
          <div><span style="font-size:11px;color:var(--muted)">STATUS</span><br><span class="${badge(wo.WorkOrderStatus)}">${wo.WorkOrderStatus}</span></div>
          <div><span style="font-size:11px;color:var(--muted)">INSPECTION</span><br><span class="${badge(wo.InspectionStatus)}">${wo.InspectionStatus}</span></div>
        </div>
        ${wo.Notes ? `<div style="margin-top:10px"><span style="font-size:11px;color:var(--muted)">NOTES</span><br><span style="color:var(--muted)">${h(wo.Notes)}</span></div>` : ""}
      </div>
      <div class="btn-row"></div>
    `);
    return;
  }

  const dtVal = v => v ? String(v).slice(0,16).replace(" ","T") : "";
  showModal(`Edit Work Order — ${h(wo.WorkOrderId)}`, `
    <input type="hidden" id="eWOId" value="${h(wo.WorkOrderId)}">
    <div class="field"><label>Title</label>${textField("eWOT", wo.Title)}</div>
    <div class="field"><label>Type</label>${statusSelect("eWOTy",["standard","change_order","warranty","inspection"],wo.WorkOrderType)}</div>
    <div class="field"><label>Assigned To</label>${userSelect("eWOA", wo.AssignedUserId)}</div>
    <div class="field"><label>Installer</label>${userSelect("eWOI", wo.InstallerUserId)}</div>
    <div class="field"><label>Status</label>${statusSelect("eWOS",["open","assigned","in_progress","complete"],wo.WorkOrderStatus)}</div>
    <div class="field"><label>Scheduled Start</label><input id="eWOSt" type="datetime-local" value="${h(dtVal(wo.ScheduledStart))}"></div>
    <div class="field"><label>Scheduled End</label><input id="eWOEn" type="datetime-local" value="${h(dtVal(wo.ScheduledEnd))}"></div>
    <div class="field"><label>Actual Start</label><input id="eWOAS" type="datetime-local" value="${h(dtVal(wo.ActualStart))}"></div>
    <div class="field"><label>Actual End</label><input id="eWOAE" type="datetime-local" value="${h(dtVal(wo.ActualEnd))}"></div>
    <div class="field"><label>Inspection Status</label>${statusSelect("eWOIn",["pending","passed","failed"],wo.InspectionStatus)}</div>
    <div class="field"><label>Invoice Status</label>${statusSelect("eWOInv",["pending","invoiced","paid"],wo.InvoiceStatus)}</div>
    <div class="field"><label>Notes</label>${textareaField("eWON", wo.Notes)}</div>
    <div class="btn-row"><button class="btn btn-primary" onclick="saveWorkOrder()">💾 Save Changes</button></div>
  `);
}
async function saveWorkOrder() {
  const id = document.getElementById("eWOId")?.value;
  if (!id) { alert("Work Order ID missing — cannot save."); return; }
  try {
    await api(`/work-orders/${encodeURIComponent(id)}`, { method: "PUT", body: JSON.stringify({
      Title: document.getElementById("eWOT").value,
      WorkOrderType: document.getElementById("eWOTy").value,
      AssignedUserId: document.getElementById("eWOA").value,
      InstallerUserId: document.getElementById("eWOI").value,
      WorkOrderStatus: document.getElementById("eWOS").value,
      ScheduledStart: document.getElementById("eWOSt").value,
      ScheduledEnd: document.getElementById("eWOEn").value,
      ActualStart: document.getElementById("eWOAS").value,
      ActualEnd: document.getElementById("eWOAE").value,
      InspectionStatus: document.getElementById("eWOIn").value,
      InvoiceStatus: document.getElementById("eWOInv").value,
      Notes: document.getElementById("eWON").value,
    })});
    hideModal(); await refreshAll(); render();
  } catch (err) {
    if (err.message && err.message.includes("locked")) {
      alert("🔒 Phase is locked.\n\nComplete all Work Orders and pass all inspections in the previous phase first.");
    } else {
      alert("Save failed: " + err.message);
    }
  }
}

async function completeTask(id) {
  await api(`/assignments/${id}/complete`, { method: "POST" });
  await refreshAll();
  if (state.selectedBid)
    state.selectedBid = state.bids.find(b => b.BidId === state.selectedBid.BidId) || state.selectedBid;
  if (state.selectedProject)
    state.selectedProject = state.projects.find(p => p.ProjectId === state.selectedProject.ProjectId) || state.selectedProject;
  render();
}

// ══════════════════════════════════
// ── ADD TASK (manual) ──
// ══════════════════════════════════
function openAddTaskModal() {
  showModal("Add New Task", `
    <div class="field"><label>Task Title</label>${textField("aNTT","","e.g. Follow up with customer")}</div>
    <div class="field"><label>Assigned To</label>${userSelect("aNTU")}</div>
    <div class="field"><label>Priority</label>${statusSelect("aNTP",["high","medium","low"],"medium")}</div>
    <div class="field"><label>Due Date</label>${dateField("aNTD", new Date().toISOString().slice(0,10))}</div>
    <div class="field"><label>Link to (Entity Type)</label>
      <select id="aNTET" onchange="toggleEntityIdField()">
        <option value="general">General (no link)</option>
        <option value="bid">Bid</option>
        <option value="project">Project</option>
        <option value="work_order">Work Order</option>
      </select>
    </div>
    <div class="field" id="aNTEIdField" style="display:none">
      <label>Entity ID</label>${textField("aNTEId","","e.g. BID-001 / PRJ-001 / WO-001")}
    </div>
    <div class="field"><label>Notes</label>${textareaField("aNTN","","Optional...")}</div>
    <div class="btn-row"><button class="btn btn-primary" onclick="addTask()">+ Add Task</button></div>
  `);
}

function toggleEntityIdField() {
  const et = document.getElementById("aNTET").value;
  document.getElementById("aNTEIdField").style.display = et === "general" ? "none" : "block";
}

async function addTask() {
  const entityType = document.getElementById("aNTET").value;
  const entityId = document.getElementById("aNTEId")?.value || "";
  try {
    await api("/assignments", { method: "POST", body: JSON.stringify({
      TaskTitle: document.getElementById("aNTT").value,
      AssignedUserId: document.getElementById("aNTU").value,
      Priority: document.getElementById("aNTP").value,
      DueDate: document.getElementById("aNTD").value,
      EntityType: entityType,
      EntityId: entityType !== "general" ? entityId : "",
      Notes: document.getElementById("aNTN").value,
    })});
    hideModal(); await refreshAll(); render();
  } catch(err) { alert("Add task failed: " + err.message); }
}

// ══════════════════════════════════
// ── EDIT TASK (manual) ──
// ══════════════════════════════════
function openEditTaskModal(taskOrKey) {
  const task = typeof taskOrKey === "string"
    ? (state.tasks.find(t => t.AssignmentId === taskOrKey) || _reg[taskOrKey])
    : taskOrKey;
  if (!task) return;
  showModal(`Edit Task — ${task.AssignmentId}`, `
    <input type="hidden" id="eTskId" value="${h(task.AssignmentId)}">
    <div class="field"><label>Task Title</label>${textField("eTskT", task.TaskTitle)}</div>
    <div class="field"><label>Assigned To</label>${userSelect("eTskU", task.AssignedUserId)}</div>
    <div class="field"><label>Status</label>${statusSelect("eTskS",["assigned","in_progress","todo","done"], task.TaskStatus)}</div>
    <div class="field"><label>Priority</label>${statusSelect("eTskP",["high","medium","low"], task.Priority)}</div>
    <div class="field"><label>Due Date</label>${dateField("eTskD", task.DueDate)}</div>
    <div class="field"><label>Notes</label>${textareaField("eTskN", task.Notes)}</div>
    <div class="btn-row"><button class="btn btn-primary" onclick="saveTask()">💾 Save Changes</button></div>
  `);
}

async function saveTask() {
  const id = document.getElementById("eTskId")?.value;
  if (!id) return;
  const status = document.getElementById("eTskS").value;
  if (status === "done") {
    try { await api(`/assignments/${id}/complete`, { method: "POST" }); }
    catch(e) { alert("Save failed: " + e.message); return; }
  } else {
    alert("To update a task's details, please use the Complete button or ask your admin to add a PUT /assignments endpoint.");
    return;
  }
  hideModal(); await refreshAll(); render();
}

// ══════════════════════════════════
// ── RENDER: HOME ──
// ══════════════════════════════════
function renderHome() {
  return `
    <div class="page-header"><h1>Workflow Hub</h1><p>Manage your full bid-to-project pipeline</p></div>
    <div class="steps">
      <div class="step step-active"><div class="step-num">1</div><span class="step-label">Create Bid</span></div>
      <span class="step-arrow">→</span>
      <div class="step step-inactive"><div class="step-num">2</div><span class="step-label">Add Tasks</span></div>
      <span class="step-arrow">→</span>
      <div class="step step-inactive"><div class="step-num">3</div><span class="step-label">Convert to Project</span></div>
      <span class="step-arrow">→</span>
      <div class="step step-inactive"><div class="step-num">4</div><span class="step-label">Manage Work Orders</span></div>
    </div>
    <div class="grid grid-2" style="margin-top:20px">
      <div class="entity-card" onclick="routeTo('bids')">
        <div class="entity-card-accent"></div>
        <div style="font-size:28px;margin-bottom:10px">📋</div>
        <div class="entity-card-title">Bids</div>
        <div class="meta-item">${state.bids.length} total · ${state.bids.filter(b=>b.BidStatus==="draft").length} draft</div>
        <div class="entity-card-footer"><span class="${badge("draft")}">${state.bids.filter(b=>b.BidStatus==="draft").length} draft</span><span class="go-btn">Open →</span></div>
      </div>
      <div class="entity-card" onclick="routeTo('projects')">
        <div class="entity-card-accent" style="background:var(--ok)"></div>
        <div style="font-size:28px;margin-bottom:10px">🏗️</div>
        <div class="entity-card-title">Projects</div>
        <div class="meta-item">${state.projects.length} total · ${state.projects.filter(p=>p.ProjectStatus==="active").length} active</div>
        <div class="entity-card-footer"><span class="${badge("active")}">${state.projects.filter(p=>p.ProjectStatus==="active").length} active</span><span class="go-btn">Open →</span></div>
      </div>
      <div class="entity-card" onclick="routeTo('tasks')">
        <div class="entity-card-accent" style="background:var(--warn)"></div>
        <div style="font-size:28px;margin-bottom:10px">✅</div>
        <div class="entity-card-title">Tasks</div>
        <div class="meta-item">${state.tasks.length} open tasks across all users</div>
        <div class="entity-card-footer"><span class="${badge("assigned")}">${state.tasks.length} open</span><span class="go-btn">Open →</span></div>
      </div>
    </div>`;
}

// ══════════════════════════════════
// ── RENDER: BIDS LIST ──
// ══════════════════════════════════
function renderBids() {
  const cards = state.bids.map(b => {
    const taskCount = state.bidTasks.filter(t => t.BidId === b.BidId).length;
    return `
      <div class="entity-card" onclick="routeTo('bid-detail',{bid:'${b.BidId}'})">
        <div class="entity-card-id">${b.BidId}</div>
        <div class="entity-card-title">${b.BidTitle}</div>
        <div class="entity-card-meta">
          <div class="meta-item">Customer: <strong>${getCustomerName(b.CustomerId)}</strong></div>
          <div class="meta-item">Estimator: <strong>${getUserName(b.EstimatorUserId)}</strong></div>
          ${b.DueDate ? `<div class="meta-item">Due: <strong>${b.DueDate}</strong></div>` : ""}
        </div>
        <div class="entity-card-footer">
          <div style="display:flex;gap:6px;align-items:center">
            <span class="${badge(b.BidStatus)}">${b.BidStatus}</span>
            <span class="badge badge-progress">${taskCount} task${taskCount!==1?"s":""}</span>
          </div>
          <span class="go-btn">View →</span>
        </div>
      </div>`;
  }).join("") || `<div class="empty"><div class="empty-icon">📋</div><h3>No bids yet</h3><p>Create your first bid</p></div>`;
  return `
    <button class="back-btn" onclick="routeTo('home')">← Home</button>
    <div class="page-header">
      <h1>Bids <span style="font-size:16px;font-weight:500;color:var(--muted);margin-left:8px">(${state.bids.length} total)</span></h1>
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:8px">
        ${["draft","assigned","submitted","approved","rejected"].map(s => {
          const n = state.bids.filter(b => b.BidStatus === s).length;
          return n > 0 ? `<span class="${badge(s)}">${n} ${s}</span>` : "";
        }).join("")}
      </div>
    </div>
    <div class="btn-row" style="margin-bottom:20px"><button class="btn btn-primary" onclick="openCreateBidModal()">+ Create Bid</button></div>
    <div class="grid grid-2">${cards}</div>`;
}

// ══════════════════════════════════
// ── RENDER: BID DETAIL ──
// ══════════════════════════════════
function renderBidDetail() {
  const b = state.selectedBid;
  if (!b) { routeTo("bids"); return ""; }
  const tasks = state.bidTasks.filter(t => t.BidId === b.BidId);
  const relatedProject = state.projects.find(p => p.BidId === b.BidId);

  const taskRows = tasks.map(t => `
    <div class="task-row">
      <span class="task-id">${t.BidTaskId}</span>
      <span class="task-name">${t.TaskName}</span>
      <span class="task-user">${getUserName(t.AssignedUserId)}</span>
      <span class="task-priority-${t.Priority}">${(t.Priority||"").toUpperCase()}</span>
      <span class="${badge(t.TaskStatus)}">${t.TaskStatus}</span>
      <span style="color:var(--muted);font-size:12px">${t.DueDate||"-"}</span>
      <div style="display:flex;gap:6px">
        <button class="btn btn-sm btn-ghost" onclick="openEditBidTaskModal('${t.BidTaskId}')">✏️ Edit</button>
        ${t.TaskStatus!=="done"
          ? `<button class="btn btn-sm btn-outline" onclick="completeBidTask('${t.BidTaskId}')">✓ Done</button>`
          : `<span class="${badge("done")}">Done</span>`}
      </div>
    </div>`).join("") || `<div style="color:var(--muted);font-size:13px;padding:12px 0">No tasks yet.</div>`;

  return `
    <button class="back-btn" onclick="routeTo('bids')">← Back to Bids</button>
    <div class="page-header">
      <h1>${b.BidTitle}</h1>
      <p><span style="font-family:'DM Mono',monospace;font-size:13px;color:var(--muted)">${b.BidId}</span> · ${getCustomerName(b.CustomerId)}</p>
    </div>
    <div class="grid" style="grid-template-columns:1fr 1fr;gap:12px;margin-bottom:20px">
      <div class="entity-card" style="cursor:default">
        <div style="display:flex;justify-content:space-between;align-items:flex-start">
          <div class="entity-card-title" style="font-size:13px;color:var(--muted)">BID DETAILS</div>
          <button class="btn btn-sm btn-ghost" onclick="openEditBidModal('${b.BidId}')">✏️ Edit Bid</button>
        </div>
        <div class="meta-item" style="margin:8px 0 4px">Status: <span class="${badge(b.BidStatus)}">${b.BidStatus}</span></div>
        <div class="meta-item" style="margin-bottom:4px">Owner: <strong>${getUserName(b.BidOwnerUserId)}</strong></div>
        <div class="meta-item" style="margin-bottom:4px">Estimator: <strong>${getUserName(b.EstimatorUserId)}</strong></div>
        <div class="meta-item" style="margin-bottom:4px">Due: <strong>${b.DueDate||"-"}</strong></div>
        <div class="meta-item" style="margin-bottom:4px">Amount: <strong>${b.TotalEstimatedAmount||"-"}</strong></div>
        ${b.Notes ? `<div class="meta-item">Notes: <em>${b.Notes}</em></div>` : ""}
      </div>
      <div class="entity-card" style="cursor:default">
        <div class="entity-card-title" style="font-size:13px;color:var(--muted);margin-bottom:8px">PROJECT</div>
        ${relatedProject
          ? `<div class="meta-item" style="margin-bottom:6px">✅ Converted</div>
             <div class="meta-item" style="margin-bottom:8px">Project: <strong>${relatedProject.ProjectId}</strong></div>
             <button class="btn btn-outline btn-sm" onclick="routeTo('project-detail',{project:'${relatedProject.ProjectId}'})">View Project →</button>`
          : `<div class="meta-item" style="margin-bottom:10px;color:var(--muted)">Not converted yet</div>
             <button class="btn btn-primary btn-sm" onclick="openConvertModal()">Convert to Project →</button>`}
      </div>
    </div>
    <div style="font-size:13px;font-weight:700;margin-bottom:8px;color:var(--muted)">BID TASKS</div>
    <button class="btn btn-outline btn-sm" style="margin-bottom:12px" onclick="openAddBidTaskModal()">+ Add Task</button>
    ${taskRows}`;
}

// ══════════════════════════════════
// ── RENDER: PROJECTS LIST ──
// ══════════════════════════════════
function renderProjects() {
  const cards = state.projects.map(p => {
    const projPhases = state.phases.filter(ph => ph.ProjectId === p.ProjectId);
    const projWOs = state.workOrders.filter(w => w.ProjectId === p.ProjectId);
    return `
      <div class="entity-card" onclick="routeTo('project-detail',{project:'${p.ProjectId}'})">
        <div class="entity-card-id">${p.ProjectId}</div>
        <div class="entity-card-title">${p.ProjectName}</div>
        <div class="entity-card-meta">
          <div class="meta-item">Customer: <strong>${getCustomerName(p.CustomerId)}</strong></div>
          <div class="meta-item">Manager: <strong>${getUserName(p.ProjectManagerUserId)}</strong></div>
        </div>
        <div style="display:flex;gap:6px;margin-bottom:10px">
          ${projPhases.map(ph=>`
            <span style="font-size:10px;padding:2px 7px;border-radius:4px;font-weight:600;
              background:${phaseColor(ph.PhaseCode)}18;color:${phaseColor(ph.PhaseCode)};
              border:1px solid ${phaseColor(ph.PhaseCode)}44">${ph.PhaseCode}</span>`).join("")}
        </div>
        <div class="entity-card-footer">
          <div style="display:flex;gap:6px">
            <span class="${badge(p.ProjectStatus)}">${p.ProjectStatus}</span>
            <span class="badge badge-draft">${projWOs.length} WOs</span>
          </div>
          <span class="go-btn">View →</span>
        </div>
      </div>`;
  }).join("") || `<div class="empty"><div class="empty-icon">🏗️</div><h3>No projects yet</h3><p>Convert a bid to create a project</p></div>`;
  return `
    <button class="back-btn" onclick="routeTo('home')">← Home</button>
    <div class="page-header">
      <h1>Projects <span style="font-size:16px;font-weight:500;color:var(--muted);margin-left:8px">(${state.projects.length} total)</span></h1>
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:8px">
        ${["active","on_hold","complete","cancelled"].map(s => {
          const n = state.projects.filter(p => p.ProjectStatus === s).length;
          return n > 0 ? `<span class="${badge(s)}">${n} ${s.replace("_"," ")}</span>` : "";
        }).join("")}
      </div>
    </div>
    <div class="grid grid-2">${cards}</div>`;
}

// ══════════════════════════════════
// ── RENDER: PROJECT DETAIL ──
// ══════════════════════════════════
function renderProjectDetail() {
  const p = state.selectedProject;
  if (!p) { routeTo("projects"); return ""; }
  const projPhases = state.phases.filter(ph => ph.ProjectId === p.ProjectId);
  const phaseOrder = ["rough","trim","startup","warranty"];

  const phaseSections = phaseOrder.map((code, idx) => {
    const ph = projPhases.find(x => x.PhaseCode === code);
    if (!ph) return "";
    const wos = state.workOrders.filter(w => w.ProjectPhaseId === ph.ProjectPhaseId);
    const color = phaseColor(code);

    // ── FIX: treat both "locked" AND "not_started" as locked ──
    const isLocked = ph.PhaseStatus === "locked" || ph.PhaseStatus === "not_started";

    const totalWOs  = wos.length;
    const doneWOs   = wos.filter(w => w.WorkOrderStatus === "complete").length;
    const passedWOs = wos.filter(w => w.InspectionStatus === "passed").length;
    const prevCode  = phaseOrder[idx - 1];

    const woCards = wos.map(w => {
      const fmtDt = v => v ? String(v).slice(0,16).replace("T"," ") : "-";
      return `
      <div class="wo-row" style="display:block;padding:0${isLocked ? ";opacity:0.75" : ""}">
        <div style="display:grid;grid-template-columns:110px 1fr 90px 130px 130px 80px 75px 70px 90px;gap:8px;align-items:center;padding:10px 12px">
          <span class="wo-id">${w.WorkOrderId}</span>
          <span class="wo-title" title="${w.Title}">${w.Title}</span>
          <span><span class="badge badge-draft" style="font-size:10px">${w.WorkOrderType||"-"}</span></span>
          <span style="font-size:12px;color:var(--muted)">${fmtDt(w.ScheduledStart)}</span>
          <span style="font-size:12px;color:var(--muted)">${fmtDt(w.ScheduledEnd)}</span>
          <span><span class="${badge(w.WorkOrderStatus)}">${w.WorkOrderStatus}</span></span>
          <span><span class="${badge(w.InspectionStatus)}">${w.InspectionStatus}</span></span>
          <span><span class="${badge(w.InvoiceStatus)}">${w.InvoiceStatus}</span></span>
          <div style="display:flex;gap:4px">
            <button class="btn btn-sm btn-ghost" onclick="toggleWODetail('${w.WorkOrderId}')">⋯ More</button>
            <button class="btn btn-sm btn-ghost" onclick="openEditWorkOrderModal('${w.WorkOrderId}')">✏️</button>
          </div>
        </div>
        <div id="wo-detail-${w.WorkOrderId}" style="display:none;padding:10px 16px 14px;border-top:1px solid var(--border);background:var(--surface2)">
          <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:10px;font-size:13px">
            <div><span style="font-size:11px;color:var(--muted);font-weight:700;text-transform:uppercase">Assigned To</span><br><strong>${getUserName(w.AssignedUserId)||"-"}</strong></div>
            <div><span style="font-size:11px;color:var(--muted);font-weight:700;text-transform:uppercase">Installer</span><br><strong>${getUserName(w.InstallerUserId)||"-"}</strong></div>
            <div><span style="font-size:11px;color:var(--muted);font-weight:700;text-transform:uppercase">Scheduled Start</span><br><strong>${fmtDt(w.ScheduledStart)}</strong></div>
            <div><span style="font-size:11px;color:var(--muted);font-weight:700;text-transform:uppercase">Scheduled End</span><br><strong>${fmtDt(w.ScheduledEnd)}</strong></div>
            <div><span style="font-size:11px;color:var(--muted);font-weight:700;text-transform:uppercase">Actual Start</span><br><strong>${fmtDt(w.ActualStart)}</strong></div>
            <div><span style="font-size:11px;color:var(--muted);font-weight:700;text-transform:uppercase">Actual End</span><br><strong>${fmtDt(w.ActualEnd)}</strong></div>
            <div><span style="font-size:11px;color:var(--muted);font-weight:700;text-transform:uppercase">WO Status</span><br><span class="${badge(w.WorkOrderStatus)}">${w.WorkOrderStatus}</span></div>
            <div><span style="font-size:11px;color:var(--muted);font-weight:700;text-transform:uppercase">Inspection</span><br><span class="${badge(w.InspectionStatus)}">${w.InspectionStatus}</span></div>
            <div><span style="font-size:11px;color:var(--muted);font-weight:700;text-transform:uppercase">Invoice</span><br><span class="${badge(w.InvoiceStatus)}">${w.InvoiceStatus}</span></div>
            ${w.Notes ? `<div style="grid-column:1/-1"><span style="font-size:11px;color:var(--muted);font-weight:700;text-transform:uppercase">Notes</span><br><span style="color:var(--muted)">${w.Notes}</span></div>` : ""}
          </div>
        </div>
      </div>`;
    }).join("");

    const lockBanner = isLocked ? `
      <div style="display:flex;align-items:center;gap:10px;padding:10px 14px;margin-bottom:10px;
        background:#fff4dd;border:1px solid #f0c060;border-radius:8px;font-size:13px">
        <span style="font-size:18px">🔒</span>
        <div>
          <strong>Phase locked</strong> — complete all Work Orders and pass all inspections in the
          <strong>${prevCode}</strong> phase to unlock.
          ${totalWOs > 0 ? `<span style="margin-left:8px;color:var(--muted)">(${doneWOs}/${totalWOs} WOs done · ${passedWOs}/${totalWOs} inspections passed)</span>` : ""}
        </div>
      </div>` : "";

    const progressBar = !isLocked && totalWOs > 0 ? (() => {
      const pct = Math.round(((doneWOs + passedWOs) / (totalWOs * 2)) * 100);
      return `
        <div style="margin-bottom:10px">
          <div style="display:flex;justify-content:space-between;font-size:11px;color:var(--muted);margin-bottom:4px">
            <span>${doneWOs}/${totalWOs} complete · ${passedWOs}/${totalWOs} passed inspection</span>
            <span>${pct}%</span>
          </div>
          <div style="height:4px;background:var(--border);border-radius:4px;overflow:hidden">
            <div style="height:100%;width:${pct}%;background:${pct===100?"var(--ok)":"var(--accent)"};border-radius:4px;transition:width 0.3s"></div>
          </div>
        </div>`;
    })() : "";

    return `
      <div class="phase-card" style="${isLocked ? "opacity:0.85" : ""}">
        <div class="phase-card-header" onclick="togglePhase('${ph.ProjectPhaseId}')" id="ph-hdr-${ph.ProjectPhaseId}">
          <div class="phase-left">
            <div class="phase-dot" style="background:${isLocked ? "var(--muted)" : color}"></div>
            <div>
              <div class="phase-name" style="color:${isLocked ? "var(--muted)" : "var(--text)"}">
                ${isLocked ? "🔒 " : ""}${code}
              </div>
              <div class="phase-id">${ph.ProjectPhaseId} · Seq ${ph.SequenceNo}</div>
            </div>
          </div>
          <div class="phase-right">
            <span class="${isLocked ? "badge badge-draft" : badge(ph.PhaseStatus)}">${isLocked ? "locked" : ph.PhaseStatus}</span>
            <span class="wo-count">${wos.length} WO${wos.length!==1?"s":""}</span>
            <button class="btn btn-sm btn-ghost" style="z-index:2" onclick="event.stopPropagation();openEditPhaseModal('${ph.ProjectPhaseId}')">✏️</button>
            <span class="chevron" id="chv-${ph.ProjectPhaseId}">›</span>
          </div>
        </div>
        <div class="phase-body" id="ph-body-${ph.ProjectPhaseId}">
          ${lockBanner}
          ${progressBar}
          ${wos.length ? `
            <div class="wo-header-row" style="grid-template-columns:110px 1fr 90px 130px 130px 80px 75px 70px 90px">
              <span>WO ID</span><span>Title</span><span>Type</span>
              <span>Sched. Start</span><span>Sched. End</span><span>Status</span>
              <span>Inspection</span><span>Invoice</span><span></span>
            </div>${woCards}` : `<div style="color:var(--muted);font-size:13px;padding:12px 0">No work orders yet.</div>`}
          <button class="add-wo-btn" onclick="openAddWorkOrderModal('${ph.ProjectPhaseId}')">+ Add Work Order to ${code} phase</button>
        </div>
      </div>`;
  }).join("");

  return `
    <button class="back-btn" onclick="routeTo('projects')">← Back to Projects</button>
    <div class="page-header">
      <h1>${p.ProjectName}</h1>
      <p><span style="font-family:'DM Mono',monospace;font-size:13px;color:var(--muted)">${p.ProjectId}</span>
        · ${getCustomerName(p.CustomerId)} · Manager: ${getUserName(p.ProjectManagerUserId)}</p>
    </div>
    <div class="entity-card" style="margin-bottom:20px;cursor:default">
      <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px">
        <div style="display:flex;gap:24px;flex-wrap:wrap">
          <div class="meta-item">Status: <span class="${badge(p.ProjectStatus)}">${p.ProjectStatus}</span></div>
          <div class="meta-item">Start: <strong>${p.StartDate||"-"}</strong></div>
          <div class="meta-item">Target: <strong>${p.TargetCompletionDate||"-"}</strong></div>
          <div class="meta-item">Bid: <strong>${p.BidId}</strong></div>
          ${p.Notes ? `<div class="meta-item">Notes: <em>${p.Notes}</em></div>` : ""}
        </div>
        <button class="btn btn-sm btn-ghost" onclick="openEditProjectModal('${p.ProjectId}')">✏️ Edit Project</button>
      </div>
    </div>
    <div style="font-size:13px;font-weight:700;margin-bottom:12px;color:var(--muted);letter-spacing:0.5px">PHASES & WORK ORDERS</div>
    ${phaseSections}`;
}

// ── Navigate from a task to its linked record ──
function navigateToTask(entityType, entityId) {
  if (entityType === "bid") {
    const bid = state.bids.find(b => b.BidId === entityId);
    if (bid) routeTo("bid-detail", { bid: bid.BidId });
  } else if (entityType === "bid_task") {
    const bt = state.bidTasks.find(t => t.BidTaskId === entityId);
    if (bt) routeTo("bid-detail", { bid: bt.BidId });
  } else if (entityType === "work_order") {
    const wo = state.workOrders.find(w => w.WorkOrderId === entityId);
    if (wo) routeTo("project-detail", { project: wo.ProjectId });
  } else if (entityType === "project") {
    routeTo("project-detail", { project: entityId });
  }
}

// ══════════════════════════════════
// ── RENDER: TASKS ──
// ══════════════════════════════════
function renderTasks() {
  const filterUser = state.taskFilter || "";

  const userOpts = `<option value="">All Users</option>` +
    state.users.map(u => `<option value="${h(u.UserId)}" ${u.UserId === filterUser ? "selected" : ""}>${h(u.DisplayName)}</option>`).join("");

  const filtered = filterUser
    ? state.tasks.filter(t => t.AssignedUserId === filterUser)
    : state.tasks;

  const groups = {};
  filtered.forEach(t => {
    const g = t.EntityType || "general";
    if (!groups[g]) groups[g] = [];
    groups[g].push(t);
  });

  const groupLabels = {
    bid: "📋 Bid Tasks", bid_task: "📝 Bid Item Tasks",
    work_order: "🔧 Work Order Tasks", project: "🏗️ Project Tasks", general: "📌 General Tasks"
  };

  const groupedHtml = Object.entries(groups).map(([type, items]) => {
    const rows = items.map(t => {
      const ds = dueDateStyle(t.DueDate);
      const canNavigate = ["bid","bid_task","work_order","project"].includes(t.EntityType) && t.EntityId;
      return `
      <div class="task-row" style="border-color:${ds.border};background:${ds.bg}">
        <span class="task-id">${t.AssignmentId}</span>
        <span class="task-name" style="flex:1">${t.TaskTitle}</span>
        <span class="task-user">${getUserName(t.AssignedUserId)}</span>
        ${canNavigate
          ? `<span style="font-size:12px;min-width:90px">
               <span onclick="navigateToTask('${t.EntityType}','${t.EntityId}')"
                 style="color:var(--accent);font-family:'DM Mono',monospace;cursor:pointer;text-decoration:underline;text-underline-offset:2px"
                 title="Open ${t.EntityId}">${t.EntityId}</span>
             </span>`
          : `<span style="font-size:12px;color:var(--muted);min-width:90px">-</span>`}
        <span class="task-priority-${(t.Priority||"medium").toLowerCase()}">${(t.Priority||"").toUpperCase()}</span>
        <span class="${badge(t.TaskStatus)}">${t.TaskStatus}</span>
        <span style="font-size:12px;font-weight:600;min-width:80px;color:${ds.border !== 'var(--border)' ? ds.border : 'var(--muted)'}">
          ${t.DueDate ? t.DueDate : "-"}
          ${ds.label ? `<br><span style="font-size:10px;opacity:0.85">${ds.label}</span>` : ""}
        </span>
        <button class="btn btn-primary btn-sm" onclick="completeTask('${t.AssignmentId}')">✓ Done</button>
      </div>`;
    }).join("");
    return `
      <div style="font-size:12px;font-weight:700;color:var(--muted);letter-spacing:0.5px;margin:18px 0 6px;text-transform:uppercase">
        ${groupLabels[type] || type} <span class="badge badge-progress">${items.length}</span>
      </div>
      ${rows}`;
  }).join("") || `<div class="empty"><div class="empty-icon">✅</div><h3>All done!</h3><p>No open tasks</p></div>`;

  return `
    <button class="back-btn" onclick="routeTo('home')">← Home</button>
    <div class="page-header"><h1>Tasks</h1><p>All open tasks across bids, work orders, and projects</p></div>
    <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px;margin-bottom:16px">
      <div style="display:flex;align-items:center;gap:10px">
        <label style="font-size:13px;font-weight:600;color:var(--muted)">Filter by user:</label>
        <select style="padding:6px 10px;border-radius:8px;border:1px solid var(--border);font-family:'DM Sans',sans-serif;font-size:13px;background:var(--surface)"
          onchange="state.taskFilter=this.value;render()">${userOpts}</select>
        <span class="badge badge-progress">${filtered.length} open</span>
      </div>
      <button class="btn btn-primary" onclick="openAddTaskModal()">+ Add Task</button>
    </div>
    ${groupedHtml}`;
}

// ── Safe object registry (fallback only — primary lookup always uses state) ──
const _reg = {};
function reg(obj) {
  // ── FIX: use most specific ID first to prevent phase collision ──
  // Before: ProjectId came before ProjectPhaseId, so all 4 phases of a project
  // would share the same registry key (the ProjectId), with warranty overwriting all.
  const key = obj.AssignmentId || obj.BidTaskId || obj.WorkOrderId ||
              obj.ProjectPhaseId || obj.BidId || obj.ProjectId ||
              ("k" + Math.random());
  _reg[key] = obj;
  return `'${key}'`;
}
function esc(obj) { return reg(obj); }

function togglePhase(phaseId) {
  const body = document.getElementById(`ph-body-${phaseId}`);
  const chv  = document.getElementById(`chv-${phaseId}`);
  const hdr  = document.getElementById(`ph-hdr-${phaseId}`);
  const open = body.classList.contains("open");
  body.classList.toggle("open", !open);
  chv.classList.toggle("open", !open);
  hdr.classList.toggle("expanded", !open);
}

function toggleWODetail(woId) {
  const panel = document.getElementById(`wo-detail-${woId}`);
  if (!panel) return;
  panel.style.display = panel.style.display !== "none" ? "none" : "block";
}

// ── Main Render ──
function render() {
  [...state.bids, ...state.bidTasks, ...state.projects,
   ...state.phases, ...state.workOrders, ...state.tasks].forEach(obj => reg(obj));

  const app = document.getElementById("app");
  switch (state.view) {
    case "home":           app.innerHTML = renderHome(); break;
    case "bids":           app.innerHTML = renderBids(); break;
    case "bid-detail":     app.innerHTML = renderBidDetail(); break;
    case "projects":       app.innerHTML = renderProjects(); break;
    case "project-detail": app.innerHTML = renderProjectDetail(); break;
    case "tasks":          app.innerHTML = renderTasks(); break;
    default:               app.innerHTML = renderHome();
  }
  updateBreadcrumb();
}

async function reloadData() { await refreshAll(); render(); }

// ── Expose globals ──
Object.assign(window, {
  routeTo, reloadData, hideModal,
  openCreateBidModal, createBid,
  openEditBidModal, saveBid,
  openAddBidTaskModal, addBidTask,
  openEditBidTaskModal, saveBidTask, completeBidTask,
  openConvertModal, convertToProject,
  openEditProjectModal, saveProject,
  openEditPhaseModal, savePhase,
  openAddWorkOrderModal, addWorkOrder,
  openEditWorkOrderModal, saveWorkOrder,
  togglePhase, toggleWODetail, completeTask,
  openAddTaskModal, addTask, toggleEntityIdField,
  openEditTaskModal, saveTask,
  navigateToTask,
});

reloadData().catch(err => {
  document.getElementById("app").innerHTML =
    `<div class="empty"><div class="empty-icon">⚠️</div><h3>Error loading data</h3><p>${err.message}</p></div>`;
});