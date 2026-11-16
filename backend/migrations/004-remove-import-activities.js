import { Activity } from '../models/index.js';
export async function up(transaction) {
  const removedImportedActivities = await Activity.destroy({ where: { action: 'imported' }, transaction });
  return { removedImportedActivities };
}
