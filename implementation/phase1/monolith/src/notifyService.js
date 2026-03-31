const { sendEmail } = require('./emailService');
const { bidAssignedEmail, taskAssignedEmail, workOrderAssignedEmail } = require('./emailTemplates');

// users map: { 'USR-001': { name: 'Bradley Heinrich', email: 'bradley@xmechanicals.com' }, ... }
// Pass this in from your data layer

async function notifyBidAssigned(accessToken, { user, bid, assignment }) {
  if (!user?.email) return;
  const template = bidAssignedEmail({
    userName: user.DisplayName,
    bidTitle: bid.BidTitle,
    bidNumber: bid.BidNumber,
    dueDate: assignment.DueDate,
    role: assignment.AssignedRole,
  });
  await sendEmail(accessToken, { to: user.email, ...template });
  console.log(`[notify] Bid assignment email sent to ${user.email}`);
}

async function notifyTaskAssigned(accessToken, { user, task }) {
  if (!user?.email) return;
  const template = taskAssignedEmail({
    userName: user.DisplayName,
    taskTitle: task.TaskTitle || task.TaskName,
    entityType: task.EntityType,
    entityId: task.EntityId,
    dueDate: task.DueDate,
    priority: task.Priority,
  });
  await sendEmail(accessToken, { to: user.email, ...template });
  console.log(`[notify] Task assignment email sent to ${user.email}`);
}

async function notifyWorkOrderAssigned(accessToken, { user, workOrder, projectName }) {
  if (!user?.email) return;
  const template = workOrderAssignedEmail({
    userName: user.DisplayName,
    workOrderTitle: workOrder.Title,
    projectName,
    scheduledStart: workOrder.ScheduledStart,
  });
  await sendEmail(accessToken, { to: user.email, ...template });
  console.log(`[notify] Work order email sent to ${user.email}`);
}

module.exports = { notifyBidAssigned, notifyTaskAssigned, notifyWorkOrderAssigned };
