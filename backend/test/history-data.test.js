import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { normalizeHistoryDate, prepareHistory } from '../utils/historyData.js';
const load = name => JSON.parse(readFileSync(new URL(`../../${name}.json`,import.meta.url),'utf8'));
const input = ['departments','employees','requests'].map(load);
test('legacy dates normalize to ISO and unzoned timestamps use Jakarta time',()=>{
  assert.equal(normalizeHistoryDate('15/12/2025'),'2025-12-15');
  assert.equal(new Date(normalizeHistoryDate('15/12/2025 10:00',true)).toISOString(),'2025-12-15T03:00:00.000Z');
  assert.throws(()=>normalizeHistoryDate('31/02/2025'));
});
test('all historical rows and original records are retained while anomalies are flagged',()=>{
  const before = JSON.stringify(input);
  const data = prepareHistory(...input);
  assert.deepEqual([data.departments.length,data.employees.length,data.requests.length],[7,26,30]);
  assert.equal(JSON.stringify(input),before);
  const employee = id=>data.employees.find(e=>e.id===id);
  const request = id=>data.requests.find(r=>r.id===id);
  assert.equal(employee('emp-026').department_id,null);
  assert.equal(employee('emp-026').source.department_id,'dept-008');
  assert.equal(employee('emp-015').manager_id,null);
  assert.equal(employee('emp-015').source.manager_id,'emp-099');
  assert.equal(request('req-022').approver_id,'emp-009');
  assert.ok(employee('emp-010').issues.length);
  assert.ok(request('req-008').issues.some(s=>s.includes('end_date')));
  assert.ok(request('req-016').issues.some(s=>s.includes('req-015')));
  assert.ok(request('req-023').issues.some(s=>s.includes('item_description')));
  assert.ok(request('req-029').issues.some(s=>s.includes('hours')));
  assert.ok(request('req-011').issues.some(s=>s.includes('inactive')));
  assert.ok(request('req-018').issues.some(s=>s.includes('Historical decision')));
  assert.equal(request('req-018').decided_by,'emp-007');
  assert.equal(request('req-024').details.start_date,'2025-12-15');
  assert.equal(request('req-024').source.details.start_date,'15/12/2025');
  assert.equal(request('req-025').status,'cancelled');
});
test('duplicate IDs and missing submitters fail before database writes',()=>{
  assert.throws(()=>prepareHistory([...input[0],input[0][0]],input[1],input[2]),/Duplicate IDs/);
  assert.throws(()=>prepareHistory(input[0],input[1], [{...input[2][0],submitted_by:'unknown'}]),/Unknown submitter/);
});
