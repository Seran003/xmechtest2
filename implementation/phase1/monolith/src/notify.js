const { getSheetRows, readWorkbook } = require('./store');
const { sendEmail } = require('./emailService');
const { bidAssigned, taskAssigned, workOrderAssigned } = require('./emailTemplates');

function getUser(userId) {
  return getSheetRows(readWorkbook(), 'Users').find(u => u.UserId === userId);
}

async function notifyAssignment(accessToken, assignment) {
  if (!accessToken) return;
  const user = getUser(assignment.AssignedUserId);
  if (!user?.Email) return;
  const { EntityType, EntityId, TaskTitle, AssignedRole, DueDate, Priority } = assignment;
  if (EntityType === 'bid') {
    const bid = getSheetRows(readWorkbook(), 'Bids').find(b => b.BidId === EntityId);
    await sendEmail(accessToken, { to: user.Email, ...bidAssigned({ userName: user.DisplayName, bidTitle: bid?.BidTitle || TaskTitle, bidNumber: bid?.BidNumber || EntityId, dueDate: DueDate, role: AssignedRole }) });
  } else if (EntityType === 'bid_task') {
    await sendEmail(accessToken, { to: user.Email, ...taskAssigned({ userName: user.DisplayName, taskTitle: TaskTitle, entityType: EntityType, entityId: EntityId, dueDate: DueDate, priority: Priority }) });
  } else if (EntityType === 'work_order') {
    const wo = getSheetRows(readWorkbook(), 'WorkOrders').find(w => w.WorkOrderId === EntityId);
    await sendEmail(accessToken, { to: user.Email, ...workOrderAssigned({ userName: user.DisplayName, woTitle: wo?.Title || TaskTitle, projectId: wo?.ProjectId || '', scheduledStart: wo?.ScheduledStart || '', dueDate: DueDate }) });
  }
}

module.exports = { notifyAssignment };
