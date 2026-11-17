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
    await models.Department.bulkCreate([{id:'dept-001',name:'Production'},{id:'dept-002',name:'Procurement'},{id:'dept-003',name:'Finance'},{id:'dept-004',name:'Human Resources'}], {transaction});
    for (const [id,name,email,role,status] of [
      ['emp-003','Ahmad Hidayat','ahmad.hidayat','Accountant','active'],
      ['emp-005','Rina Wijaya','rina.wijaya','HR Manager','active'],
      ['emp-006','Fajar Nugroho','fajar.nugroho','HR Staff','active'],
      ['emp-008','Yuni Astuti','yuni.astuti','Procurement Staff','active'],
      ['emp-002','Siti Rahayu','siti.rahayu','Finance Manager','active'],
      ['emp-001','Budi Santoso','budi.santoso','Plant Director','active'],
      ['emp-016','Agus Supriyadi','agus.supriyadi','Production Manager','active'],
      ['emp-017','Joko Susanto','joko.s','Production Operator','active'],
      ['emp-007','Hendra Gunawan','hendra.gunawan','Procurement Manager','active'],
      ['emp-021','Rizky Ramadhan','rizky.ramadhan','Production Operator','active'],
      ['emp-025','Tommy Sutanto','tommy.s','IT Staff','inactive'],
    ]) await models.Employee.create({id,name,email:`${email}@ptmajujaya.co.id`,role,status,department_id:['emp-007','emp-008'].includes(id)?'dept-002':['emp-002','emp-003'].includes(id)?'dept-003':['emp-005','emp-006'].includes(id)?'dept-004':'dept-001',password_hash:hash},{transaction});
    await models.Employee.update({manager_id:'emp-016'},{where:{id:['emp-017','emp-021']},transaction});
    await models.Employee.update({manager_id:'emp-001'},{where:{id:['emp-016','emp-007','emp-025','emp-002']},transaction});
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
  for (const [id,email] of [['operator','joko.s'],['manager','agus.supriyadi'],['other','hendra.gunawan'],['director','budi.santoso'],['finance','siti.rahayu'],['financeStaff','ahmad.hidayat'],['hrManager','rina.wijaya'],['hrStaff','fajar.nugroho'],['procStaff','yuni.astuti']]) {
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
  assert.equal(staff.body.length,11); assert.equal(staff.body[0].password_hash,undefined); assert.equal(staff.body[0].source,undefined);
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


test('leave routes to the department manager despite a cross-department reporting link', async () => {
  await models.Employee.update({manager_id:'emp-007'},{where:{id:'emp-017'}});
  try {
    const input={type:'leave',details:{leave_type:'annual',start_date:'2026-12-07',end_date:'2026-12-08',reason:'Department routing verification'}};
    const created=await api.post('/api/requests').set(auth('operator')).send(input).expect(201);
    assert.equal(created.body.approver_id,'emp-016');
    await api.post(`/api/requests/${created.body.id}/decision`).set(auth('other')).send({decision:'approved'}).expect(403);
    await api.post(`/api/requests/${created.body.id}/decision`).set(auth('manager')).send({decision:'approved'}).expect(200);
    const detail=await api.get(`/api/requests/${created.body.id}`).set(auth('operator')).expect(200);
    assert.equal(detail.body.status,'approved');
    assert.equal(detail.body.decided_by,'emp-016');
  } finally { await models.Employee.update({manager_id:'emp-016'},{where:{id:'emp-017'}}); }
});

test('manager leave and overtime require the director, with no self approval', async () => {
  for (const type of ['leave','overtime']) {
    const details=type==='leave'?{leave_type:'annual',start_date:'2026-12-10',end_date:'2026-12-11',reason:'Manager leave verification'}:{date:'2026-12-10',hours:2,reason:'Manager overtime verification'};
    const created=await api.post('/api/requests').set(auth('manager')).send({type,details}).expect(201);
    assert.equal(created.body.approver_id,'emp-001');
    await api.post(`/api/requests/${created.body.id}/decision`).set(auth('manager')).send({decision:'approved'}).expect(403);
    await api.post(`/api/requests/${created.body.id}/decision`).set(auth('other')).send({decision:'approved'}).expect(403);
    await api.post(`/api/requests/${created.body.id}/decision`).set(auth('director')).send({decision:'approved'}).expect(200);
  }
});

test('a stale leave/overtime assignment does not authorize a different department manager', async () => {
  const created=await api.post('/api/requests').set(auth('operator')).send(payload('Stale routing verification')).expect(201);
  await models.Request.update({approver_id:'emp-007'},{where:{id:created.body.id}});
  await api.get(`/api/requests/${created.body.id}`).set(auth('other')).expect(403);
  await api.post(`/api/requests/${created.body.id}/decision`).set(auth('other')).send({decision:'approved'}).expect(403);
  assert.equal((await models.Request.findByPk(created.body.id)).status,'pending');
});

test('leave/overtime submissions require an active eligible department manager', async () => {
  await models.Employee.update({status:'inactive'},{where:{id:'emp-016'}});
  try { await api.post('/api/requests').set(auth('operator')).send(payload('No active department manager')).expect(422); }
  finally { await models.Employee.update({status:'active'},{where:{id:'emp-016'}}); }
});


const purchasePayload = (item, amount = 250000) => ({type:'purchase',details:{item_description:item,estimated_cost:amount,currency:'IDR',vendor:'Approval test vendor',urgency:'normal'}});
test('employee purchase requires the department manager despite a cross-department reporting link', async () => {
  await models.Employee.update({manager_id:'emp-007'},{where:{id:'emp-017'}});
  try {
    const created=await api.post('/api/requests').set(auth('operator')).send(purchasePayload('Department purchase routing')).expect(201);
    assert.equal(created.body.approver_id,'emp-016');
    for(const user of ['operator','other','director']) await api.post(`/api/requests/${created.body.id}/decision`).set(auth(user)).send({decision:'approved'}).expect(403);
    await api.post(`/api/requests/${created.body.id}/decision`).set(auth('manager')).send({decision:'approved'}).expect(200);
    const detail=await api.get(`/api/requests/${created.body.id}`).set(auth('operator')).expect(200);
    assert.equal(detail.body.status,'approved');
    assert.equal(detail.body.decided_by,'emp-016');
    assert.equal(detail.body.activities.length,2);
  } finally { await models.Employee.update({manager_id:'emp-016'},{where:{id:'emp-017'}}); }
});

test('manager purchase automatically goes to Finance without an automatic amount threshold', async () => {
  for(const amount of [250000,150000000]) {
    const created=await api.post('/api/requests').set(auth('manager')).send(purchasePayload(`Manager purchase ${amount}`,amount)).expect(201);
    assert.equal(created.body.approver_id,'emp-002');
    for(const user of ['manager','other']) await api.post(`/api/requests/${created.body.id}/decision`).set(auth(user)).send({decision:'approved'}).expect(403);
    await api.post(`/api/requests/${created.body.id}/decision`).set(auth('finance')).send({decision:'approved'}).expect(200);
  }
});

test('purchase rejects stale assignments and blocks submissions without an active department manager', async () => {
  const created=await api.post('/api/requests').set(auth('operator')).send(purchasePayload('Stale purchase assignment')).expect(201);
  await models.Request.update({approver_id:'emp-007'},{where:{id:created.body.id}});
  await api.get(`/api/requests/${created.body.id}`).set(auth('other')).expect(403);
  await api.post(`/api/requests/${created.body.id}/decision`).set(auth('other')).send({decision:'approved'}).expect(403);
  await models.Employee.update({status:'inactive'},{where:{id:'emp-016'}});
  try { await api.post('/api/requests').set(auth('operator')).send(purchasePayload('No purchase authority')).expect(422); }
  finally { await models.Employee.update({status:'active'},{where:{id:'emp-016'}}); }
});


test('purchase manager approval forwards to Finance, which can give final approval', async () => {
  const created=await api.post('/api/requests').set(auth('operator')).send(purchasePayload('Finance final approval')).expect(201);
  const id=created.body.id;
  const forward=await api.post(`/api/requests/${id}/decision`).set(auth('manager')).send({decision:'forward_to_finance',note:'Needs Finance review'}).expect(200);
  assert.equal(forward.body.status,'pending');assert.equal(forward.body.approval_stage,'finance');assert.equal(forward.body.approver_id,'emp-002');assert.equal(forward.body.decided_by??null,null);
  await api.post(`/api/requests/${id}/decision`).set(auth('manager')).send({decision:'approved'}).expect(403);
  const previous=await api.get(`/api/requests/${id}`).set(auth('manager')).expect(200);assert.equal(previous.body.can_decide,false);
  const visible=await api.get('/api/requests?scope=all&search=Finance%20final%20approval').set(auth('manager')).expect(200);assert.ok(visible.body.some(r=>r.id===id));
  const inbox=await api.get('/api/requests?scope=inbox&status=pending').set(auth('finance')).expect(200);assert.ok(inbox.body.some(r=>r.id===id));
  const done=await api.post(`/api/requests/${id}/decision`).set(auth('finance')).send({decision:'approved',note:'Finance approved'}).expect(200);
  assert.equal(done.body.status,'approved');assert.equal(done.body.decided_by,'emp-002');
  const detail=await api.get(`/api/requests/${id}`).set(auth('operator')).expect(200);
  assert.deepEqual(detail.body.activities.map(a=>a.action),['submitted','approved_and_forwarded_to_finance','approved']);
});

test('Finance can forward a purchase to the director without finalizing it', async () => {
  const created=await api.post('/api/requests').set(auth('operator')).send(purchasePayload('Finance director escalation')).expect(201);
  const id=created.body.id;
  await api.post(`/api/requests/${id}/decision`).set(auth('manager')).send({decision:'forward_to_finance'}).expect(200);
  const forward=await api.post(`/api/requests/${id}/decision`).set(auth('finance')).send({decision:'forward_to_director',note:'Director authorization required'}).expect(200);
  assert.equal(forward.body.status,'pending');assert.equal(forward.body.approval_stage,'director');assert.equal(forward.body.approver_id,'emp-001');assert.equal(forward.body.decided_at??null,null);
  await api.post(`/api/requests/${id}/decision`).set(auth('finance')).send({decision:'approved'}).expect(403);
  await api.post(`/api/requests/${id}/decision`).set(auth('director')).send({decision:'approved'}).expect(200);
  await api.get(`/api/requests/${id}`).set(auth('finance')).expect(200);
  const detail=await api.get(`/api/requests/${id}`).set(auth('operator')).expect(200);
  assert.equal(detail.body.activities.length,4);assert.equal(detail.body.decided_by,'emp-001');
});

test('manager purchases automatically go to Finance and employees cannot bypass their manager', async () => {
  const input=purchasePayload('Automatic manager Finance review');
  await api.post('/api/requests').set(auth('operator')).send({...input,send_to_finance:true}).expect(400);
  const employee=await api.post('/api/requests').set(auth('operator')).send(input).expect(201);
  assert.equal(employee.body.approver_id,'emp-016');
  const manager=await api.post('/api/requests').set(auth('manager')).send(input).expect(201);
  assert.equal(manager.body.approval_stage,'finance');assert.equal(manager.body.approver_id,'emp-002');
  const ownFinance=await api.post('/api/requests').set(auth('finance')).send(purchasePayload('Finance Manager own purchase')).expect(201);
  assert.equal(ownFinance.body.approver_id,'emp-001');assert.equal(ownFinance.body.approval_stage,'initial');
  await api.post(`/api/requests/${ownFinance.body.id}/decision`).set(auth('finance')).send({decision:'approved'}).expect(403);
});

test('forwarding requires the correct stage and only applies to purchases', async () => {
  const created=await api.post('/api/requests').set(auth('operator')).send(purchasePayload('Forward permissions')).expect(201);
  const url=`/api/requests/${created.body.id}/decision`;
  await api.post(url).set(auth('operator')).send({decision:'forward_to_finance'}).expect(403);
  await api.post(url).set(auth('manager')).send({decision:'forward_to_director'}).expect(403);
  await api.post(url).set(auth('finance')).send({decision:'forward_to_director'}).expect(403);
  await api.post(url).set(auth('manager')).send({decision:'forward_to_finance'}).expect(200);
  await api.post(url).set(auth('finance')).send({decision:'forward_to_finance'}).expect(403);
  await api.post(url).set(auth('finance')).send({decision:'rejected',note:'Funding is unavailable.'}).expect(200);
  const overtime=await api.post('/api/requests').set(auth('operator')).send(payload('No overtime forwarding')).expect(201);
  await api.post(`/api/requests/${overtime.body.id}/decision`).set(auth('manager')).send({decision:'forward_to_finance'}).expect(403);
});

test('missing Finance or director authority leaves the request and history unchanged', async () => {
  const created=await api.post('/api/requests').set(auth('operator')).send(purchasePayload('Missing Finance authority')).expect(201);
  const id=created.body.id;
  await models.Employee.update({status:'inactive'},{where:{id:'emp-002'}});
  try { await api.post(`/api/requests/${id}/decision`).set(auth('manager')).send({decision:'forward_to_finance'}).expect(422); }
  finally { await models.Employee.update({status:'active'},{where:{id:'emp-002'}}); }
  assert.equal((await models.Request.findByPk(id)).approver_id,'emp-016');assert.equal(await models.Activity.count({where:{request_id:id}}),1);
  await api.post(`/api/requests/${id}/decision`).set(auth('manager')).send({decision:'forward_to_finance'}).expect(200);
  await models.Employee.update({status:'inactive'},{where:{id:'emp-001'}});
  try { await api.post(`/api/requests/${id}/decision`).set(auth('finance')).send({decision:'forward_to_director'}).expect(422); }
  finally { await models.Employee.update({status:'active'},{where:{id:'emp-001'}}); }
  assert.equal((await models.Request.findByPk(id)).approver_id,'emp-002');assert.equal(await models.Activity.count({where:{request_id:id}}),2);
});

test('a failed forwarding audit rolls back the reassignment and approval stage', async t => {
  const created=await api.post('/api/requests').set(auth('operator')).send(purchasePayload('Forward rollback')).expect(201);
  const original=models.Activity.create;
  const mock=t.mock.method(models.Activity,'create',async function(values,options){if(values.action==='approved_and_forwarded_to_finance')throw new Error('Intentional forwarding audit failure');return original.call(this,values,options);});
  await api.post(`/api/requests/${created.body.id}/decision`).set(auth('manager')).send({decision:'forward_to_finance'}).expect(500);
  mock.mock.restore();
  const request=await models.Request.findByPk(created.body.id);
  assert.equal(request.approver_id,'emp-016');assert.equal(request.approval_stage,'initial');assert.equal(request.status,'pending');assert.equal(await models.Activity.count({where:{request_id:request.id}}),1);
});


test('history visibility is consistent across request lists, details, filters and activities', async () => {
  const owners=[['operator','emp-017'],['manager','emp-016'],['other','emp-007'],['procStaff','emp-008'],['director','emp-001'],['finance','emp-002'],['financeStaff','emp-003'],['hrManager','emp-005'],['hrStaff','emp-006']];
  const matrix=[];
  await db.transaction(async transaction=>{
    for(const [owner,id] of owners) for(const type of ['purchase','leave','overtime']) for(const status of ['approved','rejected','cancelled','pending']) {
      const key=`history-access-${owner}-${type}-${status}`;
      const details=type==='purchase'?purchasePayload(key).details:type==='leave'?{leave_type:'annual',start_date:'2026-12-20',end_date:'2026-12-21',reason:key}:{date:'2026-12-20',hours:2,reason:key};
      await models.Request.create({id:key,type,status,submitted_by:id,approver_id:owner==='procStaff'?'emp-017':null,submitted_at:new Date(),details,issues:[]},{transaction});
      await models.Activity.create({request_id:key,actor_id:id,action:status==='pending'?'submitted':status,note:key,created_at:new Date()},{transaction});
      matrix.push({id:key,owner,type,status});
    }
  });
  function permitted(viewer,row) {
    if(['director','finance','financeStaff'].includes(viewer))return true;
    if(row.owner===viewer)return true;
    if(['hrStaff','hrManager'].includes(viewer)&&['leave','overtime'].includes(row.type))return true;
    if(viewer==='manager'&&row.owner==='operator')return true;
    if(viewer==='other'&&row.owner==='procStaff')return true;
    if(viewer==='hrManager'&&row.owner==='hrStaff')return true;
    return false;
  }
  for(const [viewer] of owners) {
    const expected=matrix.filter(row=>permitted(viewer,row));
    const list=await api.get('/api/requests?scope=all&search=history-access').set(auth(viewer)).expect(200);
    assert.deepEqual(list.body.map(r=>r.id).sort(),expected.map(r=>r.id).sort(),viewer+' request list');
    const filtered=await api.get('/api/requests?scope=all&search=history-access&type=purchase&status=approved').set(auth(viewer)).expect(200);
    assert.deepEqual(filtered.body.map(r=>r.id).sort(),expected.filter(r=>r.type==='purchase'&&r.status==='approved').map(r=>r.id).sort(),viewer+' filters');
    const events=await api.get('/api/activity').set(auth(viewer)).expect(200);
    assert.deepEqual(events.body.filter(a=>a.request_id.startsWith('history-access')).map(a=>a.request_id).sort(),expected.map(r=>r.id).sort(),viewer+' activities');
    for(const type of ['purchase','leave','overtime']) {
      const allowed=expected.find(r=>r.type===type);if(allowed)await api.get(`/api/requests/${allowed.id}`).set(auth(viewer)).expect(200);
      const denied=matrix.find(r=>r.type===type&&!permitted(viewer,r));if(denied)await api.get(`/api/requests/${denied.id}`).set(auth(viewer)).expect(403);
    }
  }
  await api.get('/api/requests?scope=inbox&search=history-access').set(auth('operator')).expect(403);
  const financeRequest=matrix.find(r=>r.owner==='manager'&&r.type==='purchase'&&r.status==='pending');
  await api.post(`/api/requests/${financeRequest.id}/decision`).set(auth('financeStaff')).send({decision:'approved'}).expect(403);
  const me=await api.get('/api/auth/me').set(auth('hrStaff')).expect(200);assert.equal(me.body.canBrowseHistory,true);assert.equal(me.body.department_name,'Human Resources');
});


test('approval inbox is available only to managers and director, independently of history access', async () => {
  for(const user of ['operator','procStaff','hrStaff','financeStaff']) {
    await api.get('/api/requests?scope=inbox').set(auth(user)).expect(403);
    const me=await api.get('/api/auth/me').set(auth(user)).expect(200);
    assert.equal(me.body.canApproveRequests,false);
    if(['hrStaff','financeStaff'].includes(user))assert.equal(me.body.canBrowseHistory,true);
  }
  for(const user of ['manager','other','hrManager','finance','director']) {
    await api.get('/api/requests?scope=inbox').set(auth(user)).expect(200);
    const me=await api.get('/api/auth/me').set(auth(user)).expect(200);
    assert.equal(me.body.canApproveRequests,true);
  }
});


test('imported pending requests are assigned, approved, rejected, forwarded, or cancelled without rewriting source', async () => {
  const { assignPendingHistory } = await import('../utils/pendingHistory.js');
  for (const decision of ['approved', 'rejected', 'cancel']) {
    const created = await api.post('/api/requests').set(auth('operator')).send(payload('pending import '+decision)).expect(201);
    const source = {...created.body, status:'pending'};
    await models.Request.update({source,approver_id:null},{where:{id:created.body.id}});
    const assignment = await db.transaction(assignPendingHistory);
    assert.ok(assignment.assigned.some(r => r.id === created.body.id && r.approver_id === 'emp-016'));
    assert.equal((await db.transaction(assignPendingHistory)).assigned.length,0);
    const inbox = await api.get('/api/requests?scope=inbox&status=pending').set(auth('manager')).expect(200);
    assert.ok(inbox.body.some(r => r.id === created.body.id));
    const detail = await api.get(`/api/requests/${created.body.id}`).set(auth('manager')).expect(200);
    assert.equal(detail.body.can_decide,true);
    assert.equal(detail.body.source,undefined);
    await api.post(`/api/requests/${created.body.id}/decision`).set(auth('other')).send({decision:'approved'}).expect(403);
    if (decision === 'cancel') await api.post(`/api/requests/${created.body.id}/cancel`).set(auth('operator')).expect(200);
    else await api.post(`/api/requests/${created.body.id}/decision`).set(auth('manager')).send({decision,note:'Reviewed imported request'}).expect(200);
    const resolved = (await models.Request.unscoped().findByPk(created.body.id)).toJSON();
    assert.equal(resolved.status,decision === 'cancel' ? 'cancelled' : decision);
    assert.deepEqual(resolved.source,source);
    await api.post(`/api/requests/${created.body.id}/decision`).set(auth('manager')).send({decision:'approved'}).expect(409);
    await db.transaction(assignPendingHistory);
    assert.deepEqual((await models.Request.unscoped().findByPk(created.body.id)).toJSON(),resolved);
  }
  const purchase = await api.post('/api/requests').set(auth('operator')).send({type:'purchase',details:{item_description:'Imported purchase review',estimated_cost:100,currency:'IDR',vendor:'Supplier',urgency:'normal'}}).expect(201);
  const source = {...purchase.body};
  await models.Request.update({source,approver_id:null},{where:{id:purchase.body.id}});
  await db.transaction(assignPendingHistory);
  await api.post(`/api/requests/${purchase.body.id}/decision`).set(auth('manager')).send({decision:'forward_to_finance',note:'Finance review needed'}).expect(200);
  assert.equal((await models.Request.findByPk(purchase.body.id)).approver_id,'emp-002');
  await api.post(`/api/requests/${purchase.body.id}/decision`).set(auth('finance')).send({decision:'approved'}).expect(200);
  assert.deepEqual((await models.Request.unscoped().findByPk(purchase.body.id)).source,source);
});
