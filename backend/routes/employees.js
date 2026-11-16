import { Router } from 'express';
import { list, activity } from '../controllers/employeeController.js';
import { authenticate } from '../middleware/auth.js';
import { requireRoles } from '../middleware/permissions.js';
export const employeeRoutes = Router();
employeeRoutes.get('/', authenticate, requireRoles('Plant Director', 'HR Manager'), list);
export const activityRoutes = Router();
activityRoutes.get('/', authenticate, activity);
