import { Employee, Request, Activity } from '../models/index.js';
import { resolveRoleApprover } from '../utils/policy.js';
export async function up(transaction) {
  const employees = await Employee.findAll({ transaction });
  const pending = await Request.findAll({ where: { source: null, type:'purchase', status:'pending', approval_stage:'initial' }, transaction, lock:transaction.LOCK.UPDATE });
  const changed = [];
  for (const request of pending) {
    const employee = employees.find(e => e.id === request.submitted_by);
    if (!employee || !/\bManager$/i.test(employee.role || '') || employee.role === 'Finance Manager') continue;
    const approver_id = resolveRoleApprover('Finance Manager', employees, [employee.id]);
    const previous = request.approver_id;
    await request.update({ approver_id, approval_stage:'finance' }, { transaction });
    await Activity.create({ request_id:request.id, actor_id:null, action:'reassigned', created_at:new Date(), note:JSON.stringify({ reason:'Managers purchase requests automatically go to Finance for review.', previous_approver_id:previous, approver_id }) }, { transaction });
    changed.push({ id:request.id, previous_approver_id:previous, approver_id });
  }
  return { changed };
}
