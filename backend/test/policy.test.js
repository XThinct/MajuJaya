import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolveApprover, canDecide, canView } from '../utils/policy.js';
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
  assert.equal(canView({ id: 'c', isAdmin: true }, request), true);
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
