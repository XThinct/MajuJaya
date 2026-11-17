import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolveApprover, canDecide, canView, resolveRequestApprover, resolveCurrentApprover, purchaseDecisionOptions } from '../utils/policy.js';
import { requestSchema } from '../utils/validation.js';
const employees = JSON.parse(readFileSync(new URL('../../employees.json', import.meta.url)));
test('reporting cycles and missing managers resolve to department manager without self-approval', () => {
  for (const [id, expected] of [['emp-010','emp-009'],['emp-011','emp-009'],['emp-015','emp-013'],['emp-020','emp-016'],['emp-026','emp-001'],['emp-001',null]]) {
    assert.equal(resolveApprover(employees.find(e => e.id === id), employees), expected);
  }
});
test('self approval and admin override cannot bypass assignment', () => {
  const request = { submitted_by: 'a', approver_id: 'b', status: 'pending' };
  assert.equal(canDecide({ id: 'a', isAdmin: true }, request), false);
  assert.equal(canDecide({ id: 'c', isAdmin: true }, request), false);
  assert.equal(canDecide({ id: 'b' }, request), true);
  assert.equal(canView({ id: 'c' }, request), false);
  assert.equal(canView({ id: 'c', isAdmin: true }, request), false);
  assert.equal(canView({ id: 'c', role:'Plant Director' }, request), true);
});
test('new requests reject reversed dates, impossible dates, excess overtime, negative costs, and spoofed identities', () => {
  const leave = { type: 'leave', details: { leave_type: 'annual', start_date: '2026-01-20', end_date: '2026-01-10', reason: 'Holiday' } };
  assert.equal(requestSchema.safeParse(leave).success, false);
  assert.equal(requestSchema.safeParse({ ...leave, details: { ...leave.details, start_date: '2026-02-30', end_date: '2026-03-01' } }).success, false);
  assert.equal(requestSchema.safeParse({ type: 'overtime', details: { date: '2026-01-20', hours: 14, reason: 'Work' } }).success, false);
  const purchase = { type: 'purchase', details: { item_description: 'Gloves', estimated_cost: 100, currency: 'IDR', vendor: 'Vendor', urgency: 'normal' } };
  assert.equal(requestSchema.safeParse(purchase).success, true);
  assert.equal(requestSchema.safeParse({ ...purchase, submitted_by: 'someone-else' }).success, false);
  assert.equal(requestSchema.safeParse({ ...purchase, details: { ...purchase.details, estimated_cost: -1 } }).success, false);
});


test('requests route by requester role, department and request type', () => {
  for (const type of ['leave','overtime','purchase']) {
    for (const employee of employees.filter(e => e.status === 'active')) {
      const approverId = resolveRequestApprover(employee,employees,type);
      if (employee.role === 'Plant Director' || employee.department_id === 'dept-008') {
        assert.equal(approverId,null); continue;
      }
      const approver = employees.find(e => e.id === approverId);
      assert.ok(approver,employee.id);
      assert.equal(approver.status,'active');
      assert.notEqual(approver.id,employee.id);
      if (/Manager$/.test(employee.role)) assert.equal(approver.role,type === 'purchase' && employee.role !== 'Finance Manager' ? 'Finance Manager' : 'Plant Director');
      else { assert.equal(approver.department_id,employee.department_id); assert.match(approver.role,/Manager$/); }
    }
  }
});

test('leave/overtime ignore another department manager and non-manager reporting links', () => {
  const staff = employees.find(e=>e.id==='emp-017');
  for (const manager_id of ['emp-007','emp-018','emp-001',null]) {
    assert.equal(resolveRequestApprover({...staff,manager_id},employees,'leave'),'emp-016');
    assert.equal(resolveRequestApprover({...staff,manager_id},employees,'overtime'),'emp-016');
  }
  for (const id of ['emp-010','emp-011']) assert.equal(resolveRequestApprover(employees.find(e=>e.id===id),employees,'leave'),'emp-009');
  const manager = employees.find(e=>e.id==='emp-016');
  assert.equal(resolveRequestApprover({...manager,manager_id:'emp-017'},employees,'leave'),'emp-001');
});

test('leave/overtime fail closed with missing, inactive or ambiguous authorities', () => {
  const staff = employees.find(e=>e.id==='emp-017');
  const noManager = employees.map(e=>e.id==='emp-016'?{...e,status:'inactive'}:e);
  assert.equal(resolveRequestApprover(staff,noManager,'leave'),null);
  assert.equal(resolveRequestApprover({...staff,department_id:null},employees,'overtime'),null);
  const manager = employees.find(e=>e.id==='emp-016');
  assert.equal(resolveRequestApprover(manager,employees.filter(e=>e.id!=='emp-001'),'leave'),null);
  assert.equal(resolveRequestApprover(manager,employees.map(e=>e.id==='emp-001'?{...e,status:'inactive'}:e),'overtime'),null);
  const ambiguous = [...employees,{...manager,id:'other-production-manager'}];
  assert.equal(resolveRequestApprover({...staff,manager_id:null},ambiguous,'leave'),null);
  assert.equal(resolveRequestApprover(staff,ambiguous,'leave'),'emp-016');
});

test('purchase ignores another department manager and has no director fallback for staff', () => {
  const staff = employees.find(e=>e.id==='emp-017');
  assert.equal(resolveRequestApprover({...staff,manager_id:'emp-007'},employees,'purchase'),'emp-016');
  assert.equal(resolveRequestApprover({...staff,manager_id:'emp-001'},employees,'purchase'),'emp-016');
  assert.equal(resolveRequestApprover(staff,employees.map(e=>e.id==='emp-016'?{...e,status:'inactive'}:e),'purchase'),null);
  assert.equal(resolveRequestApprover(employees.find(e=>e.id==='emp-026'),employees,'purchase'),null);
  assert.equal(resolveRequestApprover(employees.find(e=>e.id==='emp-016'),employees.filter(e=>e.id!=='emp-002'),'purchase'),null);
});


test('purchase review stages authorize only the current role and keep prior actors visible', () => {
  const request={id:'example',type:'purchase',submitted_by:'emp-017',approver_id:'emp-016',status:'pending',approval_stage:'initial'};
  assert.equal(purchaseDecisionOptions({id:'emp-016'},request,employees).can_forward_to_finance,true);
  const finance={...request,approver_id:'emp-002',approval_stage:'finance'};
  assert.equal(resolveCurrentApprover(finance,employees),'emp-002');
  assert.equal(purchaseDecisionOptions({id:'emp-016'},finance,employees).can_decide,false);
  assert.equal(purchaseDecisionOptions({id:'emp-002'},finance,employees).can_forward_to_director,true);
  assert.equal(purchaseDecisionOptions({id:'emp-002'},finance,employees).can_forward_to_finance,false);
  const director={...finance,approver_id:'emp-001',approval_stage:'director'};
  assert.equal(resolveCurrentApprover(director,employees),'emp-001');
  assert.equal(purchaseDecisionOptions({id:'emp-001'},director,employees).can_decide,true);
  assert.equal(purchaseDecisionOptions({id:'emp-001'},director,employees).can_forward_to_finance,false);
  assert.equal(resolveCurrentApprover({...finance,type:'leave'},employees),null);
  assert.equal(resolveCurrentApprover({...finance,submitted_by:'emp-002'},employees),null);
  assert.equal(canView({id:'emp-016',role:'Production Manager',department_id:'dept-001'},{...finance,submitter:{role:'Production Operator',department_id:'dept-001'},activities:[{actor_id:'emp-016'}]}),true);
  assert.equal(canView({id:'emp-007',role:'Procurement Manager',department_id:'dept-004'},{...finance,submitter:{role:'Production Operator',department_id:'dept-001'},activities:[{actor_id:'emp-007'}]}),false);
});


test('history access combines own, department staff, HR, Finance and director permissions', () => {
  const staff={id:'employee',role:'Production Operator',department_id:'production',department_name:'Production'};
  const manager={id:'manager',role:'Production Manager',department_id:'production',department_name:'Production'};
  const other={submitted_by:'other',type:'purchase',approver_id:staff.id,submitter:{role:'Production Operator',department_id:'production'},activities:[{actor_id:staff.id}]};
  assert.equal(canView(staff,other),false);
  assert.equal(canView(manager,other),true);
  assert.equal(canView(manager,{...other,submitter:{role:'Plant Director',department_id:'production'}}),false);
  assert.equal(canView(manager,{...other,submitter:{role:'Another Manager',department_id:'production'}}),false);
  assert.equal(canView(manager,{...other,submitter:{role:'Staff',department_id:'other'}}),false);
  const hr={id:'hr',role:'HR Staff',department_id:'hr',department_name:'Human Resources'};
  for(const type of ['leave','overtime']) assert.equal(canView(hr,{...other,type}),true);
  assert.equal(canView(hr,other),false);
  assert.equal(canView(hr,{...other,submitted_by:'hr'}),true);
  for(const role of ['Accountant','Finance Staff','Finance Manager']) {
    const finance={id:'finance',role,department_id:'finance',department_name:'Finance & Accounting'};
    for(const type of ['purchase','leave','overtime']) assert.equal(canView(finance,{...other,type}),true);
  }
  assert.equal(canView({id:'unknown',role:'Finance Manager',department_id:null,department_name:null},other),false);
});
