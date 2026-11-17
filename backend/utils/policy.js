export const canApproveRequests = user => user.role === 'Plant Director' || /\bManager$/i.test(user.role || '');

export function historyPermissions(user) {
  const department = (user.department_name || user.department?.name || '').trim();
  const allRequests = user.role === 'Plant Director' || /^finance(?:\s*(?:&|and)\s*accounting)?$/i.test(department);
  const allLeaveOvertime = /^(hr|human resources)$/i.test(department);
  const teamRequests = /\bManager$/i.test(user.role || '') && Boolean(user.department_id);
  return { allRequests, allLeaveOvertime, teamRequests, canBrowseHistory: allRequests || allLeaveOvertime || teamRequests };
}
export function isDepartmentStaff(employee) {
  return employee.role !== 'Plant Director' && !/\bManager$/i.test(employee.role || '');
}
export function canView(user, request) {
  if (user.id === request.submitted_by) return true;
  const permissions = historyPermissions(user);
  if (permissions.allRequests) return true;
  if (permissions.allLeaveOvertime && ['leave','overtime'].includes(request.type)) return true;
  return Boolean(permissions.teamRequests && request.submitter && request.submitter.department_id === user.department_id && isDepartmentStaff(request.submitter));
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


export const isDepartmentApprovalRequest = type => ['purchase', 'leave', 'overtime'].includes(type);
const isManager = employee => /\bManager$/i.test(employee.role || '');
// Staff require their own department's active manager; managers require the director.
export function resolveDepartmentApprover(employee, employees) {
  if (!employee || employee.role === 'Plant Director') return null;
  const candidates = employees.filter(e => e.id !== employee.id && e.status === 'active' && (
    isManager(employee)
      ? e.role === 'Plant Director'
      : Boolean(employee.department_id) && e.department_id === employee.department_id && isManager(e)
  ));
  const direct = candidates.find(e => e.id === employee.manager_id);
  if (direct) return direct.id;
  return candidates.length === 1 ? candidates[0].id : null;
}
export function resolveRequestApprover(employee, employees, type) {
  if (type === 'purchase' && employee && isManager(employee) && employee.role !== 'Finance Manager') return resolveRoleApprover('Finance Manager', employees, [employee.id]);
  return isDepartmentApprovalRequest(type) ? resolveDepartmentApprover(employee, employees) : resolveApprover(employee, employees);
}


export function resolveRoleApprover(role, employees, excluded = []) {
  const candidates = employees.filter(e => e.status === 'active' && e.role === role && !excluded.includes(e.id));
  return candidates.length === 1 ? candidates[0].id : null;
}
export function resolveCurrentApprover(request, employees) {
  const stage = request.approval_stage || 'initial';
  if (stage === 'initial') return resolveRequestApprover(employees.find(e => e.id === request.submitted_by), employees, request.type);
  if (request.type !== 'purchase') return null;
  if (stage === 'finance') return resolveRoleApprover('Finance Manager', employees, [request.submitted_by]);
  if (stage === 'director') return resolveRoleApprover('Plant Director', employees, [request.submitted_by]);
  return null;
}
export function purchaseDecisionOptions(user, request, employees) {
  const actor = employees.find(e => e.id === user.id);
  const can_decide = Boolean(actor?.status === 'active' && canDecide(user, request) && resolveCurrentApprover(request, employees) === user.id);
  const stage = request.approval_stage || 'initial';
  return {
    can_decide,
    can_forward_to_finance: can_decide && request.type === 'purchase' && stage === 'initial' && isManager(actor) && actor.role !== 'Finance Manager',
    can_forward_to_director: can_decide && request.type === 'purchase' && ['initial','finance'].includes(stage) && actor.role === 'Finance Manager',
  };
}
