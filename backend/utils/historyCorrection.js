import { isDeepStrictEqual } from 'node:util';
// Correct importer-derived fields only when the original historical record is untouched.
export function historyCorrection(current, expected) {
  if (!current) return { skip: 'Historical request is missing.' };
  if (!isDeepStrictEqual(current.source, expected.source)) return { skip: 'Source differs from the reference JSON.' };
  for (const key of ['type','submitted_by','status','decided_by','notes','details']) {
    if (!isDeepStrictEqual(current[key] ?? null, expected[key] ?? null)) return { skip: `Request ${key} changed after import.` };
  }
  for (const key of ['submitted_at','decided_at']) {
    const a = current[key] ? new Date(current[key]).getTime() : null;
    const b = expected[key] ? new Date(expected[key]).getTime() : null;
    if (a !== b) return { skip: `Request ${key} changed after import.` };
  }
  if (current.decision_note != null && current.decision_note !== expected.decision_note) return { skip: 'Decision note changed after import.' };
  const patch = {};
  for (const key of ['approver_id','decision_note','issues']) {
    if (!isDeepStrictEqual(current[key] ?? null, expected[key] ?? null)) patch[key] = expected[key];
  }
  return { patch };
}
