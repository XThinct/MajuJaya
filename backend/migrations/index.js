import { DataTypes } from 'sequelize';
import { pathToFileURL } from 'node:url';
import { sequelize } from '../config/database.js';
import { up } from './001-initial.js';
import { up as importHistory } from './002-history-json.js';
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
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    await migrate({ includeHistory: process.argv.includes('--import-history') });
  } catch (error) { console.error(error.message); process.exitCode = 1; }
  finally { await sequelize.close(); }
}
