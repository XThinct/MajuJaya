import { Employee, Request, Activity } from '../models/index.js';
import { resolveRequestApprover } from '../utils/policy.js';
export async function up(transaction) {
  const employees = await Employee.findAll({ transaction });
  const requests = await Request.findAll({ where: { source: null, type: 'purchase', status: 'pending' }, transaction, lock: transaction.LOCK.UPDATE });
  const warning = 'No eligible department manager or director is configured for this request.';
  const changed = [], unassigned = [];
  for (const request of requests) {
    const employee = employees.find(e => e.id === request.submitted_by);
    const approver_id = resolveRequestApprover(employee, employees, 'purchase');
    if (!approver_id) unassigned.push(request.id);
    const issues = (request.issues || []).filter(issue => issue !== warning);
    if (!approver_id) issues.push(warning);
    if (request.approver_id === approver_id && JSON.stringify(issues) === JSON.stringify(request.issues || [])) continue;
    const previous = request.approver_id;
    await request.update({ approver_id, issues }, { transaction });
    await Activity.create({ request_id: request.id, actor_id: null, action: 'reassigned', created_at: new Date(), note: JSON.stringify({ reason: 'Within-budget purchase approval: staff to their department manager; managers to the director. Budget is managed outside this application.', previous_approver_id: previous, approver_id }) }, { transaction });
    changed.push({ id: request.id, previous_approver_id: previous, approver_id });
  }
  return { changed, unassigned };
}
