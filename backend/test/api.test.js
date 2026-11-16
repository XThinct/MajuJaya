import nodeTest, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import supertest from 'supertest';
dotenv.config({ path: new URL('../../.env', import.meta.url), quiet: true });
const enabled = Boolean(process.env.TEST_DB_NAME);
const test = (name, fn) => nodeTest(name, { skip: !enabled }, fn);
const developmentName = process.env.DB_NAME;
if (enabled) {
  if (!process.env.TEST_DB_NAME.endsWith('_test') || process.env.TEST_DB_NAME === developmentName) throw new Error('TEST_DB_NAME must end in _test and differ from DB_NAME.');
  process.env.DB_NAME = process.env.TEST_DB_NAME;
  for (const key of ['HOST','USER','PASS','PORT']) if (process.env[`TEST_DB_${key}`]) process.env[`DB_${key}`] = process.env[`TEST_DB_${key}`];
  process.env.DB_LOGGING = 'false';
  process.env.JWT_SECRET = 'isolated-test-secret-with-at-least-32-characters';
}
const password = 'Test-password-123!';
let db, api, models, tokens = {}, fixturesCreated = false;
const auth = id => ({ Authorization: `Bearer ${tokens[id]}` });
const payload = reason => ({ type: 'overtime', details: { date: '2026-11-20', hours: 2, reason } });
before(async () => {
  if (!enabled) return;
  db = (await import('../config/database.js')).sequelize;
  models = await import('../models/index.js');
  const { migrate } = await import('../migrations/index.js');
  await migrate();
  assert.equal(await models.Employee.count(), 0, 'Use an empty dedicated test database.');
  assert.equal(await models.Request.count(), 0, 'Use an empty dedicated test database.');
  const hash = await bcrypt.hash(password, 12);
  await db.transaction(async transaction => {
    await models.Department.create({id:'dept-001',name:'Production'}, {transaction});
    for (const [id,name,email,role,status] of [
      ['emp-001','Budi Santoso','budi.santoso','Plant Director','active'],
      ['emp-016','Agus Supriyadi','agus.supriyadi','Production Manager','active'],
      ['emp-017','Joko Susanto','joko.s','Production Operator','active'],
      ['emp-007','Hendra Gunawan','hendra.gunawan','Procurement Manager','active'],
      ['emp-021','Rizky Ramadhan','rizky.ramadhan','Production Operator','active'],
      ['emp-025','Tommy Sutanto','tommy.s','IT Staff','inactive'],
    ]) await models.Employee.create({id,name,email:`${email}@ptmajujaya.co.id`,role,status,department_id:'dept-001',password_hash:hash,issues:[]},{transaction});
    await models.Employee.update({manager_id:'emp-016'},{where:{id:['emp-017','emp-021']},transaction});
    await models.Employee.update({manager_id:'emp-001'},{where:{id:['emp-016','emp-007','emp-025']},transaction});
    const purchase={item_description:'CNC parts',estimated_cost:100,currency:'IDR',vendor:'Vendor',urgency:'normal'};
    for (const [id,submitter,approver,type,details] of [
      ['req-001','emp-007','emp-001','purchase',purchase],
      ['req-004','emp-017','emp-016','purchase',purchase],
      ['req-008','emp-021','emp-016','leave',{leave_type:'annual',start_date:'2026-01-20',end_date:'2026-01-10',reason:'Time off'}],
      ['req-029','emp-021','emp-016','overtime',{date:'2026-01-20',hours:14,reason:'Work'}],
    ]) await models.Request.create({id,submitted_by:submitter,approver_id:approver,type,details,status:'pending',submitted_at:new Date(),issues:[]},{transaction});
  });
  fixturesCreated = true;
  api = supertest((await import('../app.js')).app);
  for (const [id,email] of [['operator','joko.s'],['manager','agus.supriyadi'],['other','hendra.gunawan'],['director','budi.santoso']]) {
    const result = await api.post('/api/auth/login').send({ email: `${email}@ptmajujaya.co.id`, password }).expect(200);
    tokens[id] = result.body.token;
  }
}, { timeout: 30000 });
after(async () => {
  if (!db) return;
  try {
    if (fixturesCreated) await db.transaction(async transaction => {
      await models.Activity.destroy({where:{},transaction});
      await models.Request.destroy({where:{},transaction});
      await models.Employee.update({manager_id:null},{where:{},transaction});
      await models.Employee.destroy({where:{},transaction});
      await models.Department.destroy({where:{},transaction});
    });
  } finally { await db.close(); }
});
test('authentication required; inactive employees and incorrect passwords cannot log in', async () => {
  await api.get('/api/requests').expect(401);
  await api.post('/api/auth/login').send({ email: 'tommy.s@ptmajujaya.co.id', password: password }).expect(401);
  await api.post('/api/auth/login').send({ email: 'joko.s@ptmajujaya.co.id', password: 'wrong' }).expect(401);
  const me = await api.get('/api/auth/me').set(auth('operator')).expect(200);
  assert.equal(me.body.id,'emp-017'); assert.equal(me.body.password_hash, undefined);
});
test('request visibility and employee directory permissions are enforced by API', async () => {
  const mine = await api.get('/api/requests?scope=mine').set(auth('operator')).expect(200);
  assert.ok(mine.body.every(r => r.submitted_by === 'emp-017'));
  const search = await api.get('/api/requests?search=leave').set(auth('operator')).expect(200);
  assert.equal(search.body.length, 0);
  await api.get('/api/requests/req-001').set(auth('operator')).expect(403);
  await api.get('/api/employees').set(auth('operator')).expect(403);
  const staff = await api.get('/api/employees').set(auth('director')).expect(200);
  assert.equal(staff.body.length,6); assert.equal(staff.body[0].password_hash,undefined); assert.equal(staff.body[0].source,undefined);
  const inbox = await api.get('/api/requests?scope=inbox&status=pending&search=Joko').set(auth('manager')).expect(200);
  assert.ok(inbox.body.length > 0); assert.ok(inbox.body.every(r => r.approver_id === 'emp-016'));
});
test('create, prevent duplicate, reject unauthorized decisions, and approve with audit history', async () => {
  const input = payload('Integration approval flow');
  const created = await api.post('/api/requests').set(auth('operator')).send(input).expect(201);
  const id = created.body.id;
  assert.equal(created.body.approver_id,'emp-016');
  await api.post('/api/requests').set(auth('operator')).send(input).expect(409);
  await api.post(`/api/requests/${id}/decision`).set(auth('operator')).send({ decision:'approved' }).expect(403);
  await api.post(`/api/requests/${id}/decision`).set(auth('other')).send({ decision:'approved' }).expect(403);
  await api.post(`/api/requests/${id}/decision`).set(auth('director')).send({ decision:'approved' }).expect(403);
  await api.post(`/api/requests/${id}/decision`).set(auth('manager')).send({ decision:'approved', note:'Confirmed schedule' }).expect(200);
  await api.post(`/api/requests/${id}/decision`).set(auth('manager')).send({ decision:'approved' }).expect(409);
  const detail = await api.get(`/api/requests/${id}`).set(auth('operator')).expect(200);
  assert.equal(detail.body.status,'approved'); assert.equal(detail.body.activities.length,2); assert.equal(detail.body.decision_note,'Confirmed schedule');
});
test('simultaneous decisions produce one result and one audit event', async () => {
  const created = await api.post('/api/requests').set(auth('operator')).send(payload('Concurrent decision')).expect(201);
  const url = `/api/requests/${created.body.id}/decision`;
  const results = await Promise.all([api.post(url).set(auth('manager')).send({decision:'approved'}), api.post(url).set(auth('manager')).send({decision:'rejected',note:'Competing decision'})]);
  assert.deepEqual(results.map(r => r.status).sort(),[200,409]);
  assert.equal(await models.Activity.count({where:{request_id:created.body.id}}),2);
});
test('rejection needs a reason and invalid historical requests cannot be approved', async () => {
  await api.post('/api/requests/req-008/decision').set(auth('manager')).send({decision:'approved'}).expect(422);
  await api.post('/api/requests/req-029/decision').set(auth('manager')).send({decision:'approved'}).expect(422);
  await api.post('/api/requests/req-008/decision').set(auth('manager')).send({decision:'rejected',note:' '}).expect(400);
  await api.post('/api/requests/req-008/decision').set(auth('manager')).send({decision:'rejected',note:'Please correct the dates.'}).expect(200);
});
test('only requester can cancel a pending request', async () => {
  const created = await api.post('/api/requests').set(auth('operator')).send(payload('Cancellation flow')).expect(201);
  const url = `/api/requests/${created.body.id}/cancel`;
  await api.post(url).set(auth('manager')).expect(403);
  await api.post(url).set(auth('operator')).expect(200);
  await api.post(url).set(auth('operator')).expect(409);
  assert.equal(await models.Activity.count({where:{request_id:created.body.id,action:'cancelled'}}),1);
});
test('audit insertion failure rolls back a decision', async t => {
  const created = await api.post('/api/requests').set(auth('operator')).send(payload('Transaction rollback')).expect(201);
  const original = models.Activity.create;
  const mock = t.mock.method(models.Activity,'create',async function(values, options) { if (values.action === 'approved') throw new Error('Intentional audit failure'); return original.call(this,values,options); });
  await api.post(`/api/requests/${created.body.id}/decision`).set(auth('manager')).send({decision:'approved'}).expect(500);
  mock.mock.restore();
  assert.equal((await models.Request.findByPk(created.body.id)).status,'pending');
  assert.equal(await models.Activity.count({where:{request_id:created.body.id}}),1);
});
test('new invalid input is rejected rather than imported as a historical exception', async () => {
  await api.post('/api/requests').set(auth('operator')).send({type:'leave',details:{leave_type:'annual',start_date:'2026-11-20',end_date:'2026-11-19',reason:'Time off'}}).expect(400);
  await api.post('/api/requests').set(auth('operator')).send({...payload('Spoofed'),submitted_by:'emp-001'}).expect(400);
  await api.get('/api/requests?status=invalid').set(auth('operator')).expect(400);
});
