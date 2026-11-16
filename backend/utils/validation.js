import { z } from 'zod';
const text = z.string().trim().min(1).max(2000);
const date = z.iso.date();
export const detailsSchemas = {
  purchase: z.object({ item_description: text, estimated_cost: z.number().positive().max(1e13), currency: z.literal('IDR'), vendor: text, urgency: z.enum(['low', 'normal', 'high']) }).strict(),
  leave: z.object({ leave_type: z.enum(['annual', 'sick', 'personal']), start_date: date, end_date: date, reason: text }).strict().refine(d => d.end_date >= d.start_date, { message: 'End date must be on or after start date.', path: ['end_date'] }),
  overtime: z.object({ date, hours: z.number().positive().max(12), reason: text }).strict(),
};
export const requestSchema = z.object({ type: z.enum(['purchase', 'leave', 'overtime']), details: z.unknown(), notes: z.string().trim().max(4000).optional().default('') }).strict().superRefine((v, ctx) => {
  const result = detailsSchemas[v.type].safeParse(v.details);
  if (!result.success) for (const issue of result.error.issues) ctx.addIssue({ code: 'custom', path: ['details', ...issue.path], message: issue.message });
});
export const loginSchema = z.object({ email: z.email().max(254), password: z.string().min(1).max(128) });
export const decisionSchema = z.object({ decision: z.enum(['approved', 'rejected']), note: z.string().trim().max(4000).default('') }).strict().refine(v => v.decision !== 'rejected' || v.note.length > 0, { message: 'Give a reason for rejecting this request.', path: ['note'] });
export const validate = schema => (req, res, next) => { req.body = schema.parse(req.body); next(); };
