import { DataTypes } from 'sequelize';
import { pathToFileURL } from 'node:url';
import { sequelize } from '../config/database.js';
import { up } from './001-initial.js';
import { up as importHistory } from './002-history-json.js';
import { up as correctHistory } from './003-history-decisions.js';
import { up as removeImportActivities } from './004-remove-import-activities.js';
export async function migrate({ includeHistory = false } = {}) {
  const q = sequelize.getQueryInterface();
  await q.createTable('schema_migrations', { name: { type: DataTypes.STRING, primaryKey: true } });
  await sequelize.transaction(async transaction => {
    await sequelize.query('SELECT pg_advisory_xact_lock(728115)', { transaction });
    const [rows] = await sequelize.query("SELECT name FROM schema_migrations WHERE name = '001-initial'", { transaction });
    if (!rows.length) {
      await up(q, transaction);
      await sequelize.query("INSERT INTO schema_migrations (name) VALUES ('001-initial')", { transaction });
    }
  });
  console.log('Database migrations are up to date.');
  if (includeHistory) {
    const result = await sequelize.transaction(async transaction => {
      await sequelize.query('SELECT pg_advisory_xact_lock(728115)', { transaction });
      const [rows] = await sequelize.query("SELECT name FROM schema_migrations WHERE name = '002-history-json'", { transaction });
      if (rows.length) return { alreadyApplied: true };
      const summary = await importHistory(transaction);
      await sequelize.query("INSERT INTO schema_migrations (name) VALUES ('002-history-json')", { transaction });
      return summary;
    });
    console.log(JSON.stringify(result, null, 2));
  }
  const correction = await sequelize.transaction(async transaction => {
    await sequelize.query('SELECT pg_advisory_xact_lock(728115)', { transaction });
    const [rows] = await sequelize.query("SELECT name FROM schema_migrations WHERE name IN ('002-history-json','003-history-decisions')", { transaction });
    if (!rows.some(row => row.name === '002-history-json') || rows.some(row => row.name === '003-history-decisions')) return null;
    const summary = await correctHistory(transaction);
    await sequelize.query("INSERT INTO schema_migrations (name) VALUES ('003-history-decisions')", { transaction });
    return summary;
  });
  if (correction) console.log(JSON.stringify({ migration:'003-history-decisions', ...correction }, null, 2));
  const cleanup = await sequelize.transaction(async transaction => {
    await sequelize.query('SELECT pg_advisory_xact_lock(728115)', { transaction });
    const [rows] = await sequelize.query("SELECT name FROM schema_migrations WHERE name = '004-remove-import-activities'", { transaction });
    if (rows.length) return null;
    const summary = await removeImportActivities(transaction);
    await sequelize.query("INSERT INTO schema_migrations (name) VALUES ('004-remove-import-activities')", { transaction });
    return summary;
  });
  if (cleanup) console.log(JSON.stringify({ migration:'004-remove-import-activities', ...cleanup }, null, 2));
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    await migrate({ includeHistory: process.argv.includes('--import-history') });
  } catch (error) { console.error(error.message); process.exitCode = 1; }
  finally { await sequelize.close(); }
}
