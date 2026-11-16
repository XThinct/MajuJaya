import jwt from 'jsonwebtoken';
import { Employee } from '../models/index.js';
import { env } from '../config/env.js';
import { HttpError } from '../utils/errors.js';
export const publicEmployee = e => ({ id: e.id, name: e.name, email: e.email, role: e.role, department_id: e.department_id, status: e.status, isAdmin: ['Plant Director', 'HR Manager'].includes(e.role) });
export async function authenticate(req, res, next) {
  const token = req.headers.authorization?.match(/^Bearer (.+)$/)?.[1];
  if (!token) throw new HttpError(401, 'Please sign in.');
  let payload;
  try { payload = jwt.verify(token, env.jwtSecret, { algorithms: ['HS256'], issuer: 'maju-jaya-approvals', audience: 'approvals-web' }); }
  catch { throw new HttpError(401, 'Your session has expired. Please sign in again.'); }
  const employee = await Employee.findByPk(payload.sub);
  if (!employee || employee.status !== 'active') throw new HttpError(401, 'This account is unavailable.');
  req.user = publicEmployee(employee);
  next();
}
