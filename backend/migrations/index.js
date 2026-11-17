import { DataTypes } from 'sequelize';
import { pathToFileURL } from 'node:url';
import { sequelize } from '../config/database.js';
import { up } from './001-initial.js';
import { up as importHistory } from './002-history-json.js';
import { up as routeLeaveOvertime } from './003-leave-overtime-routing.js';
import { up as routePurchases } from './004-purchase-routing.js';
import { up as purchaseReviewSchema } from './005-purchase-review-stage.js';
import { up as managerPurchasesFinance } from './006-manager-purchases-finance.js';
import { assignPendingHistory } from '../utils/pendingHistory.js';
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
  // Recorded migration names remain stable when migration filenames are renamed.
  // Apply schema extensions before data migrations use the current Sequelize models.
  await sequelize.transaction(async transaction => {
    await sequelize.query('SELECT pg_advisory_xact_lock(728115)', { transaction });
    const [rows] = await sequelize.query("SELECT name FROM schema_migrations WHERE name = '007-purchase-review-stage'", { transaction });
    if (!rows.length) {
      await purchaseReviewSchema(q, transaction);
      await sequelize.query("INSERT INTO schema_migrations (name) VALUES ('007-purchase-review-stage')", { transaction });
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
  // Workflow migrations apply only to app-created requests, never imported snapshots.
  const routing = await sequelize.transaction(async transaction => {
    await sequelize.query('SELECT pg_advisory_xact_lock(728115)', { transaction });
    const [rows] = await sequelize.query("SELECT name FROM schema_migrations WHERE name = '005-leave-overtime-routing'", { transaction });
    if (rows.length) return null;
    const summary = await routeLeaveOvertime(transaction);
    await sequelize.query("INSERT INTO schema_migrations (name) VALUES ('005-leave-overtime-routing')", { transaction });
    return summary;
  });
  if (routing) console.log(JSON.stringify({ migration:'005-leave-overtime-routing', ...routing }, null, 2));
  const purchases = await sequelize.transaction(async transaction => {
    await sequelize.query('SELECT pg_advisory_xact_lock(728115)', { transaction });
    const [rows] = await sequelize.query("SELECT name FROM schema_migrations WHERE name = '006-purchase-routing'", { transaction });
    if (rows.length) return null;
    const summary = await routePurchases(transaction);
    await sequelize.query("INSERT INTO schema_migrations (name) VALUES ('006-purchase-routing')", { transaction });
    return summary;
  });
  if (purchases) console.log(JSON.stringify({ migration:'006-purchase-routing', ...purchases }, null, 2));
  const managerPurchases = await sequelize.transaction(async transaction => {
    await sequelize.query('SELECT pg_advisory_xact_lock(728115)', { transaction });
    const [rows] = await sequelize.query("SELECT name FROM schema_migrations WHERE name = '008-manager-purchases-finance'", { transaction });
    if (rows.length) return null;
    const summary = await managerPurchasesFinance(transaction);
    await sequelize.query("INSERT INTO schema_migrations (name) VALUES ('008-manager-purchases-finance')", { transaction });
    return summary;
  });
  if (managerPurchases) console.log(JSON.stringify({ migration:'008-manager-purchases-finance', ...managerPurchases }, null, 2));
  const pendingHistory = await sequelize.transaction(async transaction => {
    await sequelize.query('SELECT pg_advisory_xact_lock(728115)', { transaction });
    return assignPendingHistory(transaction);
  });
  if (pendingHistory.assigned.length || pendingHistory.unassigned.length) console.log(JSON.stringify({ pendingHistory }, null, 2));

}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    await migrate({ includeHistory: process.argv.includes('--import-history') });
  } catch (error) { console.error(error.message); process.exitCode = 1; }
  finally { await sequelize.close(); }
}
