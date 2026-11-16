import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { login, me } from '../controllers/authController.js';
import { authenticate } from '../middleware/auth.js';
import { validate, loginSchema } from '../utils/validation.js';
export const authRoutes = Router();
authRoutes.post('/login', rateLimit({ windowMs: 15 * 60 * 1000, limit: 30, standardHeaders: 'draft-8', legacyHeaders: false, message: { message: 'Too many login attempts. Try again in 15 minutes.' } }), validate(loginSchema), login);
authRoutes.get('/me', authenticate, me);
