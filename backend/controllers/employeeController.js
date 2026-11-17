import { Employee, Department, Activity, Request } from '../models/index.js';
import { scopeWhere } from './requestController.js';
export async function list(req, res) {
  res.json(await Employee.findAll({ include: [{ model: Department, as: 'department' }, { model: Employee, as: 'manager' }], order: [['name', 'ASC']] }));
}
export async function activity(req, res) {
  const requests = await Request.findAll({ where: await scopeWhere(req.user, 'all'), attributes: ['id'] });
  res.json(await Activity.findAll({ where: { request_id: requests.map(r => r.id) }, include: [{ model: Employee, as: 'actor' }], order: [['created_at', 'DESC']], limit: 200 }));
}
