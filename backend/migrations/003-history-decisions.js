import { readFile } from 'node:fs/promises';
import { Request, Activity } from '../models/index.js';
import { prepareHistory } from '../utils/historyData.js';
import { historyCorrection } from '../utils/historyCorrection.js';
export async function up(transaction) {
  const input = await Promise.all(['departments','employees','requests'].map(async name => JSON.parse(await readFile(new URL(`../../${name}.json`,import.meta.url),'utf8'))));
  const expected = prepareHistory(...input).requests;
  const summary = { corrected:[], unchanged:[], skipped:[] };
  for (const row of expected) {
    const current = await Request.unscoped().findByPk(row.id,{transaction,lock:transaction.LOCK.UPDATE});
    const result = historyCorrection(current?.toJSON(),row);
    if (result.skip) { summary.skipped.push({id:row.id,reason:result.skip}); continue; }
    const fields = Object.keys(result.patch);
    if (!fields.length) { summary.unchanged.push(row.id); continue; }
    const previous = Object.fromEntries(fields.map(key => [key,current[key]]));
    await current.update(result.patch,{transaction});
    await Activity.create({request_id:row.id,actor_id:null,action:'history_corrected',created_at:new Date(),note:JSON.stringify({reason:'Aligned imported decision fields with requests.json; original status, decision, dates, details, and source retained.',previous,corrected:result.patch})},{transaction});
    summary.corrected.push({id:row.id,fields});
  }
  return summary;
}
