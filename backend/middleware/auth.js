import jwt from 'jsonwebtoken';
import { Employee, Department } from '../models/index.js';
import { env } from '../config/env.js';
import { HttpError } from '../utils/errors.js';
import { historyPermissions, canApproveRequests } from '../utils/policy.js';
export const publicEmployee = e => {
  const user = { id:e.id, name:e.name, email:e.email, role:e.role, department_id:e.department_id, department_name:e.department?.name || null, status:e.status, isAdmin:['Plant Director','HR Manager'].includes(e.role) };
  const permissions = historyPermissions(user);
  return { ...user, historyPermissions:permissions, canBrowseHistory:permissions.canBrowseHistory, canApproveRequests:canApproveRequests(user) };
};
export async function authenticate(req, res, next) {
  const token = req.headers.authorization?.match(/^Bearer (.+)$/)?.[1];
  if (!token) throw new HttpError(401, 'Please sign in.');
  let payload;
  try { payload = jwt.verify(token, env.jwtSecret, { algorithms: ['HS256'], issuer: 'maju-jaya-approvals', audience: 'approvals-web' }); }
  catch { throw new HttpError(401, 'Your session has expired. Please sign in again.'); }
  const employee = await Employee.findByPk(payload.sub, { include:[{model:Department,as:'department'}] });
  if (!employee || employee.status !== 'active') throw new HttpError(401, 'This account is unavailable.');
  req.user = publicEmployee(employee);
  next();
}
