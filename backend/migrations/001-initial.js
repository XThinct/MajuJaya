import { DataTypes as D } from 'sequelize';
export async function up(q, transaction) {
  const opts = { transaction };
  const pk = () => ({ type: D.STRING, primaryKey: true });
  const employeeRef = () => ({ type: D.STRING, references: { model: 'employees', key: 'id' } });
  await q.createTable('departments', { id: pk(), name: { type: D.STRING, allowNull: false }, location: D.STRING }, opts);
  await q.createTable('employees', {
    id: pk(), name: { type: D.STRING, allowNull: false }, email: { type: D.STRING, allowNull: false, unique: true }, role: D.STRING,
    department_id: { type: D.STRING, references: { model: 'departments', key: 'id' } }, manager_id: employeeRef(), status: D.STRING,
    join_date: D.DATEONLY, end_date: D.DATEONLY, password_hash: { type: D.STRING, allowNull: false }, issues: { type: D.JSONB, defaultValue: [] }, source: D.JSONB,
  }, opts);
  await q.createTable('requests', {
    id: pk(), type: { type: D.STRING, allowNull: false }, submitted_by: { ...employeeRef(), allowNull: false }, approver_id: employeeRef(),
    submitted_at: { type: D.DATE, allowNull: false }, status: { type: D.STRING, allowNull: false }, decided_by: employeeRef(), decided_at: D.DATE,
    decision_note: D.TEXT, details: { type: D.JSONB, allowNull: false }, notes: D.TEXT, issues: { type: D.JSONB, defaultValue: [] }, source: D.JSONB,
  }, opts);
  await q.createTable('activities', {
    id: { type: D.UUID, primaryKey: true }, request_id: { type: D.STRING, allowNull: false, references: { model: 'requests', key: 'id' } },
    actor_id: employeeRef(), action: { type: D.STRING, allowNull: false }, note: D.TEXT, created_at: { type: D.DATE, allowNull: false },
  }, opts);
  await q.addIndex('requests', ['submitted_by', 'submitted_at'], opts);
  await q.addIndex('requests', ['approver_id', 'status'], opts);
  await q.addIndex('activities', ['request_id', 'created_at'], opts);
  await q.sequelize.query(`ALTER TABLE requests ADD CONSTRAINT request_status CHECK (status IN ('pending','approved','rejected','cancelled')), ADD CONSTRAINT request_type CHECK (type IN ('purchase','leave','overtime'))`, opts);
}
export async function down(q, transaction) {
  for (const table of ['activities', 'requests', 'employees', 'departments']) await q.dropTable(table, { transaction });
}
