import { randomUUID } from 'node:crypto';
import { Op } from 'sequelize';
import { z } from 'zod';
import { sequelize } from '../config/database.js';
import { Request, Employee, Activity, Department } from '../models/index.js';
import { canView, resolveRequestApprover, isDepartmentApprovalRequest, resolveRoleApprover, purchaseDecisionOptions, historyPermissions, isDepartmentStaff, canApproveRequests } from '../utils/policy.js';
import { detailsSchemas } from '../utils/validation.js';
import { assert } from '../utils/errors.js';
import { logActivity } from '../middleware/activity.js';
const include = [ { model: Employee, as: 'submitter', include: [{ model: Department, as: 'department' }] }, { model: Employee, as: 'approver' }, { model: Employee, as: 'decider' } ];
export async function scopeWhere(user, scope) {
  if (scope === 'inbox') assert(canApproveRequests(user), 403, 'Approval inbox is only available to managers and the director.');
  const permissions = historyPermissions(user);
  let visible = {};
  if (!permissions.allRequests) {
    const allowed = [{ submitted_by:user.id }];
    if (permissions.allLeaveOvertime) allowed.push({ type:['leave','overtime'] });
    if (permissions.teamRequests) {
      const colleagues = await Employee.findAll({ where:{department_id:user.department_id}, attributes:['id','role'] });
      const staffIds = colleagues.filter(isDepartmentStaff).map(e=>e.id);
      allowed.push({ submitted_by:staffIds });
    }
    visible = { [Op.or]:allowed };
  }
  if (scope === 'mine') return { [Op.and]:[visible,{submitted_by:user.id}] };
  if (scope === 'inbox') return { [Op.and]:[visible,{approver_id:user.id,submitted_by:{[Op.ne]:user.id}}] };
  return visible;
}
export async function list(req, res) {
  const query = z.object({ scope: z.enum(['all', 'mine', 'inbox']).default('all'), status: z.enum(['pending', 'approved', 'rejected', 'cancelled']).optional(), type: z.enum(['purchase', 'leave', 'overtime']).optional(), search: z.string().max(150).optional() }).parse(req.query);
  const where = await scopeWhere(req.user, query.scope);
  if (query.status) where.status = query.status;
  if (query.type) where.type = query.type;
  // Keep access constraints in a separate AND clause when searching.
  const search = query.search?.trim();
  const finalWhere = search ? { [Op.and]: [where, { [Op.or]: [{ id: { [Op.iLike]: `%${search}%` } }, { '$submitter.name$': { [Op.iLike]: `%${search}%` } }, sequelize.where(sequelize.cast(sequelize.col('Request.details'), 'text'), { [Op.iLike]: `%${search}%` })] }] } : where;
  res.json(await Request.findAll({ where: finalWhere, include, order: [['submitted_at', 'DESC']] }));
}
export async function detail(req, res) {
  const request = await Request.unscoped().findByPk(req.params.id, { include: [...include, { model: Activity, as: 'activities', include: [{ model: Employee, as: 'actor' }] }], order: [[{ model: Activity, as: 'activities' }, 'created_at', 'ASC']] });
  assert(request, 404, 'Request not found.');
  assert(canView(req.user, request), 403, 'You do not have access to this request.');
  const data = request.toJSON();
  delete data.source;
  const employees = await Employee.findAll();
  const options = purchaseDecisionOptions(req.user, request, employees);
  res.json({ ...data, ...options, can_cancel: request.status === 'pending' && request.submitted_by === req.user.id });
}
export async function create(req, res) {
  const employees = await Employee.findAll();
  const employee = employees.find(e => e.id === req.user.id);
  const approver_id = resolveRequestApprover(employee, employees, req.body.type);
  const approval_stage = req.body.type === 'purchase' && /\bManager$/i.test(employee.role || '') && employee.role !== 'Finance Manager' ? 'finance' : 'initial';
  if (approval_stage === 'finance') assert(approver_id, 422, 'No independent active Finance Manager is configured for this request.');
  assert(approver_id, 422, isDepartmentApprovalRequest(req.body.type) ? 'No eligible department manager or director is configured for this request. Contact HR.' : 'No eligible approver is configured. Contact HR.');
  const details = detailsSchemas[req.body.type].parse(req.body.details);
  const record = await sequelize.transaction(async transaction => {
    // Serialize submissions per employee, including duplicate checks.
    await Employee.findByPk(req.user.id, { transaction, lock: transaction.LOCK.UPDATE });
    const duplicate = await Request.findOne({ where: { submitted_by: req.user.id, type: req.body.type, details: { [Op.eq]: details }, status: 'pending' }, transaction });
    assert(!duplicate, 409, 'An identical pending request already exists.');
    const request = await Request.create({ id: `req-${randomUUID()}`, type: req.body.type, submitted_by: req.user.id, approver_id, approval_stage, status: 'pending', submitted_at: new Date(), details, notes: req.body.notes, issues: [] }, { transaction });
    await logActivity(transaction, request.id, req.user.id, 'submitted', [approval_stage === 'finance' ? 'Submitted to Finance for review.' : '', req.body.notes].filter(Boolean).join('\n'));
    return request;
  });
  res.status(201).json(record);
}
export async function decide(req, res) {
  const record = await sequelize.transaction(async transaction => {
    const request = await Request.unscoped().findByPk(req.params.id, { transaction, lock: transaction.LOCK.UPDATE });
    assert(request, 404, 'Request not found.');
    assert(request.submitted_by !== req.user.id && request.approver_id === req.user.id, 403, 'Only the assigned approver can decide this request.');
    assert(request.status === 'pending', 409, 'This request has already been resolved.');
    const employees = await Employee.findAll({ transaction });
    const options = purchaseDecisionOptions(req.user, request, employees);
    assert(options.can_decide, 403, 'You are not authorized to decide this request at its current approval stage.');
    const forwarding = ['forward_to_finance','forward_to_director'].includes(req.body.decision);
    if (req.body.decision === 'forward_to_finance') assert(options.can_forward_to_finance, 403, 'Only the assigned department manager can forward this purchase to Finance.');
    if (req.body.decision === 'forward_to_director') assert(options.can_forward_to_director, 403, 'Only the assigned Finance Manager can forward this purchase to the director.');
    if (req.body.decision === 'approved' || forwarding) {
      const submitter = await Employee.findByPk(request.submitted_by, { transaction });
      assert(submitter.status === 'active', 422, 'Requests from inactive employees cannot be approved. Reject with a reason.');
      assert(detailsSchemas[request.type].safeParse(request.details).success, 422, 'The historical details are invalid. Reject with a reason and ask the employee to resubmit.');
    }
    if (forwarding) {
      const toFinance = req.body.decision === 'forward_to_finance';
      const role = toFinance ? 'Finance Manager' : 'Plant Director';
      const approver_id = resolveRoleApprover(role, employees, [request.submitted_by, req.user.id]);
      assert(approver_id, 422, `No independent active ${role} is configured for this request.`);
      const next = employees.find(e => e.id === approver_id);
      await request.update({ approver_id, approval_stage: toFinance ? 'finance' : 'director' }, { transaction });
      await logActivity(transaction, request.id, req.user.id, toFinance ? 'approved_and_forwarded_to_finance' : 'approved_and_forwarded_to_director', [`Approval recorded. Sent to ${next.name} (${next.role}).`, req.body.note].filter(Boolean).join('\n'));
      return request;
    }
    await request.update({ status: req.body.decision, decided_by: req.user.id, decided_at: new Date(), decision_note: req.body.note }, { transaction });
    await logActivity(transaction, request.id, req.user.id, req.body.decision, req.body.note);
    return request;
  });
  const data = record.toJSON();
  delete data.source;
  res.json(data);
}
export async function cancel(req, res) {
  const record = await sequelize.transaction(async transaction => {
    const request = await Request.unscoped().findByPk(req.params.id, { transaction, lock: transaction.LOCK.UPDATE });
    assert(request, 404, 'Request not found.');
    assert(request.submitted_by === req.user.id, 403, 'Only the requester can cancel this request.');
    assert(request.status === 'pending', 409, 'Only pending requests can be cancelled.');
    await request.update({ status: 'cancelled' }, { transaction });
    await logActivity(transaction, request.id, req.user.id, 'cancelled');
    return request;
  });
  const data = record.toJSON();
  delete data.source;
  res.json(data);
}
