import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { Employee } from '../models/index.js';
import { publicEmployee } from '../middleware/auth.js';
import { env } from '../config/env.js';
import { HttpError } from '../utils/errors.js';
const dummyHash = bcrypt.hashSync('unavailable-account-password', 12);
export async function login(req, res) {
  const employee = await Employee.scope('withPassword').findOne({ where: { email: req.body.email.toLowerCase() } });
  const valid = await bcrypt.compare(req.body.password, employee?.password_hash || dummyHash);
  if (!valid || !employee || employee.status !== 'active') throw new HttpError(401, 'Email or password is incorrect, or account is inactive.');
  const user = publicEmployee(employee);
  const token = jwt.sign({}, env.jwtSecret, { subject: employee.id, expiresIn: '8h', algorithm: 'HS256', issuer: 'maju-jaya-approvals', audience: 'approvals-web' });
  res.json({ user, token });
}
export function me(req, res) { res.json(req.user); }
