import { Employee, Request, Activity } from '../models/index.js';
import { resolveRequestApprover } from '../utils/policy.js';
export async function up(transaction) {
  const employees = await Employee.findAll({ transaction });
  const requests = await Request.findAll({ where: { source: null, type: ['leave','overtime'], status: 'pending' }, transaction, lock: transaction.LOCK.UPDATE });
  const changed = [];
  const unassigned = [];
  for (const request of requests) {
    const employee = employees.find(e => e.id === request.submitted_by);
    const approver_id = resolveRequestApprover(employee, employees, request.type);
    if (!approver_id) unassigned.push(request.id);
    if (request.approver_id === approver_id) continue;
    const previous = request.approver_id;
    await request.update({ approver_id }, { transaction });
    await Activity.create({ request_id: request.id, actor_id: null, action: 'reassigned', created_at: new Date(), note: JSON.stringify({ reason: 'Leave/overtime routing: staff to their department manager; managers to the director.', previous_approver_id: previous, approver_id }) }, { transaction });
    changed.push({ id: request.id, previous_approver_id: previous, approver_id });
  }
  return { changed, unassigned };
}
