import { Activity } from '../models/index.js';
// Every state change passes its transaction so the audit entry and change commit together.
export const logActivity = (transaction, request_id, actor_id, action, note = '') => Activity.create({ request_id, actor_id, action, note, created_at: new Date() }, { transaction });
