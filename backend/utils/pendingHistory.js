import { Op } from 'sequelize';
import { Employee, Request, Activity } from '../models/index.js';
import { resolveRequestApprover } from './policy.js';

// Assign only unresolved, unassigned imported requests. Never rewrite completed history.
export async function assignPendingHistory(transaction) {
  const employees = await Employee.findAll({ transaction });
  const pending = await Request.findAll({ where: { source: { [Op.ne]: null }, status: 'pending', approver_id: null }, transaction, lock: transaction.LOCK.UPDATE });
  const assigned = [], unassigned = [];
  for (const request of pending) {
    const employee = employees.find(e => e.id === request.submitted_by);
    const approver_id = resolveRequestApprover(employee, employees, request.type);
    if (!approver_id) { unassigned.push(request.id); continue; }
    const approval_stage = request.type === 'purchase' && /\bManager$/i.test(employee.role || '') && employee.role !== 'Finance Manager' ? 'finance' : 'initial';
    await request.update({ approver_id, approval_stage }, { transaction });
    await Activity.create({ request_id:request.id, actor_id:null, action:'reassigned', note:'Assigned pending request to the appropriate approver for review.' }, { transaction });
    assigned.push({ id:request.id, approver_id });
  }
  return { assigned, unassigned };
}
