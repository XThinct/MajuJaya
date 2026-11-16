import { randomUUID } from 'node:crypto';
import { Op } from 'sequelize';
import { z } from 'zod';
import { sequelize } from '../config/database.js';
import { Request, Employee, Activity, Department } from '../models/index.js';
import { canView, canDecide, resolveApprover } from '../utils/policy.js';
import { detailsSchemas } from '../utils/validation.js';
import { assert } from '../utils/errors.js';
import { logActivity } from '../middleware/activity.js';
const include = [ { model: Employee, as: 'submitter', include: [{ model: Department, as: 'department' }] }, { model: Employee, as: 'approver' }, { model: Employee, as: 'decider' } ];
export function scopeWhere(user, scope) {
  if (scope === 'mine') return { submitted_by: user.id };
  if (scope === 'inbox') return { approver_id: user.id, submitted_by: { [Op.ne]: user.id } };
  return user.isAdmin ? {} : { [Op.or]: [{ submitted_by: user.id }, { approver_id: user.id }] };
}
export async function list(req, res) {
  const query = z.object({ scope: z.enum(['all', 'mine', 'inbox']).default('all'), status: z.enum(['pending', 'approved', 'rejected', 'cancelled']).optional(), type: z.enum(['purchase', 'leave', 'overtime']).optional(), search: z.string().max(150).optional() }).parse(req.query);
  const where = scopeWhere(req.user, query.scope);
  if (query.status) where.status = query.status;
  if (query.type) where.type = query.type;
  // Keep access constraints in a separate AND clause when searching.
  const search = query.search?.trim();
  const finalWhere = search ? { [Op.and]: [where, { [Op.or]: [{ id: { [Op.iLike]: `%${search}%` } }, { '$submitter.name$': { [Op.iLike]: `%${search}%` } }, sequelize.where(sequelize.cast(sequelize.col('Request.details'), 'text'), { [Op.iLike]: `%${search}%` })] }] } : where;
  res.json(await Request.findAll({ where: finalWhere, include, order: [['submitted_at', 'DESC']] }));
}
export async function detail(req, res) {
  const request = await Request.findByPk(req.params.id, { include: [...include, { model: Activity, as: 'activities', include: [{ model: Employee, as: 'actor' }] }], order: [[{ model: Activity, as: 'activities' }, 'created_at', 'ASC']] });
  assert(request, 404, 'Request not found.');
  assert(canView(req.user, request), 403, 'You do not have access to this request.');
  const data = request.toJSON();
  delete data.source;
  res.json({ ...data, can_decide: canDecide(req.user, request), can_cancel: request.status === 'pending' && request.submitted_by === req.user.id });
}
export async function create(req, res) {
  const employees = await Employee.findAll();
  const employee = employees.find(e => e.id === req.user.id);
  const approver_id = resolveApprover(employee, employees);
  assert(approver_id, 422, 'No eligible approver is configured. Contact HR.');
  const details = detailsSchemas[req.body.type].parse(req.body.details);
  const record = await sequelize.transaction(async transaction => {
    // Serialize submissions per employee, including duplicate checks.
    await Employee.findByPk(req.user.id, { transaction, lock: transaction.LOCK.UPDATE });
    const duplicate = await Request.findOne({ where: { submitted_by: req.user.id, type: req.body.type, details: { [Op.eq]: details }, status: 'pending' }, transaction });
    assert(!duplicate, 409, 'An identical pending request already exists.');
    const request = await Request.create({ id: `req-${randomUUID()}`, type: req.body.type, submitted_by: req.user.id, approver_id, status: 'pending', submitted_at: new Date(), details, notes: req.body.notes, issues: [] }, { transaction });
    await logActivity(transaction, request.id, req.user.id, 'submitted', req.body.notes);
    return request;
  });
  res.status(201).json(record);
}
export async function decide(req, res) {
  const record = await sequelize.transaction(async transaction => {
    const request = await Request.findByPk(req.params.id, { transaction, lock: transaction.LOCK.UPDATE });
    assert(request, 404, 'Request not found.');
    assert(request.submitted_by !== req.user.id && request.approver_id === req.user.id, 403, 'Only the assigned approver can decide this request.');
    assert(request.status === 'pending', 409, 'This request has already been resolved.');
    if (req.body.decision === 'approved') {
      const submitter = await Employee.findByPk(request.submitted_by, { transaction });
      assert(submitter.status === 'active', 422, 'Requests from inactive employees cannot be approved. Reject with a reason.');
      assert(detailsSchemas[request.type].safeParse(request.details).success, 422, 'The historical details are invalid. Reject with a reason and ask the employee to resubmit.');
    }
    await request.update({ status: req.body.decision, decided_by: req.user.id, decided_at: new Date(), decision_note: req.body.note }, { transaction });
    await logActivity(transaction, request.id, req.user.id, req.body.decision, req.body.note);
    return request;
  });
  res.json(record);
}
export async function cancel(req, res) {
  const record = await sequelize.transaction(async transaction => {
    const request = await Request.findByPk(req.params.id, { transaction, lock: transaction.LOCK.UPDATE });
    assert(request, 404, 'Request not found.');
    assert(request.submitted_by === req.user.id, 403, 'Only the requester can cancel this request.');
    assert(request.status === 'pending', 409, 'Only pending requests can be cancelled.');
    await request.update({ status: 'cancelled' }, { transaction });
    await logActivity(transaction, request.id, req.user.id, 'cancelled');
    return request;
  });
  res.json(record);
}
