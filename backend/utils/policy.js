export function canView(user, request) {
  return user.id === request.submitted_by || user.id === request.approver_id || Boolean(user.isAdmin);
}
export function canDecide(user, request) {
  return request.status === 'pending' && request.submitted_by !== user.id && request.approver_id === user.id;
}
// Invalid or cyclic reporting lines fall back to an active department manager, then director.
export function resolveApprover(employee, employees) {
  if (employee.role === 'Plant Director' && !employee.manager_id) return null;
  const byId = new Map(employees.map(e => [e.id, e]));
  const seen = new Set([employee.id]);
  let current = employee;
  let valid = true;
  while (current?.manager_id) {
    if (seen.has(current.manager_id) || !byId.has(current.manager_id)) { valid = false; break; }
    seen.add(current.manager_id);
    current = byId.get(current.manager_id);
  }
  const direct = byId.get(employee.manager_id);
  if (valid && direct?.status === 'active' && direct.id !== employee.id) return direct.id;
  const fallback = employees.find(e => e.id !== employee.id && e.status === 'active' && e.department_id === employee.department_id && /Manager$/.test(e.role));
  return fallback?.id || employees.find(e => e.id !== employee.id && e.status === 'active' && e.role === 'Plant Director')?.id || null;
}
