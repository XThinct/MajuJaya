import { HttpError } from '../utils/errors.js';
export const requireRoles = (...roles) => (req, res, next) => {
  if (!roles.includes(req.user.role)) throw new HttpError(403, 'You do not have permission to access this resource.');
  next();
};
