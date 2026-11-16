import { z } from 'zod';
import { detailsSchemas } from './validation.js';
import { resolveApprover } from './policy.js';
const validDate = z.iso.date();
const validTimestamp = z.iso.datetime({ offset: true });
export function normalizeHistoryDate(value, timestamp = false) {
  if (value == null) return null;
  const match = value.match(/^(\d{2})\/(\d{2})\/(\d{4})(?: (\d{2}):(\d{2}))?$/);
  const normalized = match ? `${match[3]}-${match[2]}-${match[1]}${timestamp ? `T${match[4] || '00'}:${match[5] || '00'}:00+07:00` : ''}` : value;
  (timestamp ? validTimestamp : validDate).parse(normalized);
  return normalized;
}
export function prepareHistory(departments, employees, requests) {
  for (const [name, rows] of Object.entries({ departments, employees, requests })) {
    if (!Array.isArray(rows)) throw new Error(`${name} must be an array.`);
    if (new Set(rows.map(r => r.id)).size !== rows.length) throw new Error(`Duplicate IDs in ${name}.`);
  }
  const departmentIds = new Set(departments.map(d => d.id));
  const employeeIds = new Set(employees.map(e => e.id));
  const employeeRows = employees.map(e => {
    const issues = [];
    const approver = resolveApprover(e, employees);
    if (!departmentIds.has(e.department_id)) issues.push(`Unknown department: ${e.department_id}`);
    if (e.manager_id && !employeeIds.has(e.manager_id)) issues.push(`Unknown manager: ${e.manager_id}`);
    if (e.manager_id !== approver && e.role !== 'Plant Director') issues.push(`Reporting chain needs review; assigned fallback approver: ${approver || 'none'}`);
    return { id: e.id, name: e.name, email: e.email.toLowerCase(), role: e.role, status: e.status,
      department_id: departmentIds.has(e.department_id) ? e.department_id : null,
      manager_id: employeeIds.has(e.manager_id) ? e.manager_id : null,
      join_date: normalizeHistoryDate(e.join_date), end_date: normalizeHistoryDate(e.end_date), issues, source: structuredClone(e) };
  });
  const seen = new Map();
  const requestRows = requests.map(r => {
    const employee = employees.find(e => e.id === r.submitted_by);
    if (!employee) throw new Error(`Unknown submitter ${r.submitted_by} in ${r.id}.`);
    if (!detailsSchemas[r.type]) throw new Error(`Unknown request type in ${r.id}.`);
    if (!['pending','approved','rejected','cancelled'].includes(r.status)) throw new Error(`Unknown request status in ${r.id}.`);
    const details = structuredClone(r.details);
    const issues = [];
    for (const key of ['start_date','end_date','date']) if (details[key]) details[key] = normalizeHistoryDate(details[key]);
    const parsed = detailsSchemas[r.type].safeParse(details);
    if (!parsed.success) issues.push(...parsed.error.issues.map(i => `${i.path.join('.')}: ${i.message}`));
    if (employee.status !== 'active') issues.push('Submitter is inactive.');
    const signature = JSON.stringify([r.submitted_by, r.type, Object.keys(details).sort().map(key => [key, details[key]])]);
    if (seen.has(signature)) issues.push(`Possible duplicate of ${seen.get(signature)}. Review before approving.`);
    else seen.set(signature, r.id);
    const approver_id = resolveApprover(employee, employees);
    if (employee.manager_id !== approver_id) issues.push(`Reporting chain needs review; fallback approver: ${approver_id || 'none'}`);
    if (r.approved_by && r.approved_by !== approver_id) issues.push(`Historical decision by ${r.approved_by} differs from the assigned approver.`);
    if (r.approved_by && !employeeIds.has(r.approved_by)) issues.push(`Unknown historical decision maker: ${r.approved_by}`);
    return { id:r.id, type:r.type, submitted_by:r.submitted_by, submitted_at:normalizeHistoryDate(r.submitted_at,true),
      status:r.status, approver_id, decided_by:employeeIds.has(r.approved_by) ? r.approved_by : null,
      decided_at:normalizeHistoryDate(r.approved_at,true), details, notes:r.notes ?? null, issues, source:structuredClone(r) };
  });
  return { departments: departments.map(d => ({ id:d.id, name:d.name, location:d.location })), employees:employeeRows, requests:requestRows };
}
