import { readFile } from 'node:fs/promises';
import bcrypt from 'bcryptjs';
import { Department, Employee, Request, Activity } from '../models/index.js';
import { prepareHistory } from '../utils/historyData.js';
import { env } from '../config/env.js';
const load = async name => JSON.parse(await readFile(new URL(`../../${name}.json`, import.meta.url), 'utf8'));
export async function up(transaction) {
  const input = await Promise.all(['departments','employees','requests'].map(load));
  const data = prepareHistory(...input);
  const password = process.env.IMPORT_PASSWORD || (env.production ? '' : 'Welcome123!');
  if (password.length < 10) throw new Error('Set IMPORT_PASSWORD to at least 10 characters before importing employee accounts.');
  const result = { departments:{created:0,existing:0}, employees:{created:0,existing:0}, requests:{created:0,existing:0}, activities:0 };
  for (const row of data.departments) {
    const [,created] = await Department.findOrCreate({where:{id:row.id},defaults:row,transaction});
    result.departments[created ? 'created' : 'existing']++;
  }
  const addedEmployees = [];
  for (const row of data.employees) {
    if (await Employee.findByPk(row.id,{transaction})) { result.employees.existing++; continue; }
    await Employee.create({...row,manager_id:null,password_hash:await bcrypt.hash(password,12)},{transaction});
    addedEmployees.push(row); result.employees.created++;
  }
  // Insert all employees before applying self-referencing reporting relationships.
  for (const row of addedEmployees) await Employee.update({manager_id:row.manager_id},{where:{id:row.id},transaction});
  for (const row of data.requests) {
    const [,created] = await Request.findOrCreate({where:{id:row.id},defaults:row,transaction});
    result.requests[created ? 'created' : 'existing']++;
    if (!created) continue;
    if (row.decided_by && row.decided_at) {
      await Activity.create({request_id:row.id,actor_id:row.decided_by,action:row.status,note:row.notes,created_at:row.decided_at},{transaction});
      result.activities++;
    }
  }
  return {...result, flaggedEmployees:data.employees.filter(e=>e.issues.length).map(e=>e.id), flaggedRequests:data.requests.filter(r=>r.issues.length).map(r=>r.id)};
}
