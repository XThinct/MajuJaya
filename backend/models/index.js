import { DataTypes as D } from 'sequelize';
import { sequelize } from '../config/database.js';
export const Department = sequelize.define('Department', { id: { type: D.STRING, primaryKey: true }, name: { type: D.STRING, allowNull: false }, location: D.STRING }, { tableName: 'departments' });
export const Employee = sequelize.define('Employee', {
  id: { type: D.STRING, primaryKey: true }, name: { type: D.STRING, allowNull: false }, email: { type: D.STRING, allowNull: false, unique: true },
  role: D.STRING, department_id: D.STRING, manager_id: D.STRING, status: D.STRING, join_date: D.DATEONLY, end_date: D.DATEONLY,
  password_hash: { type: D.STRING, allowNull: false }, issues: { type: D.JSONB, defaultValue: [] }, source: D.JSONB,
}, { tableName: 'employees', defaultScope: { attributes: { exclude: ['password_hash', 'source'] } }, scopes: { withPassword: {} } });
export const Request = sequelize.define('Request', {
  id: { type: D.STRING, primaryKey: true }, type: { type: D.STRING, allowNull: false }, submitted_by: { type: D.STRING, allowNull: false },
  approver_id: D.STRING, submitted_at: { type: D.DATE, allowNull: false }, status: { type: D.STRING, allowNull: false },
  decided_by: D.STRING, decided_at: D.DATE, decision_note: D.TEXT, details: { type: D.JSONB, allowNull: false }, notes: D.TEXT,
  issues: { type: D.JSONB, defaultValue: [] }, source: D.JSONB,
}, { tableName: 'requests', defaultScope: { attributes: { exclude: ['source'] } } });
export const Activity = sequelize.define('Activity', {
  id: { type: D.UUID, primaryKey: true, defaultValue: D.UUIDV4 }, request_id: { type: D.STRING, allowNull: false },
  actor_id: D.STRING, action: { type: D.STRING, allowNull: false }, note: D.TEXT, created_at: { type: D.DATE, allowNull: false, defaultValue: D.NOW },
}, { tableName: 'activities' });
Employee.belongsTo(Department, { as: 'department', foreignKey: 'department_id' });
Employee.belongsTo(Employee, { as: 'manager', foreignKey: 'manager_id' });
Request.belongsTo(Employee, { as: 'submitter', foreignKey: 'submitted_by' });
Request.belongsTo(Employee, { as: 'approver', foreignKey: 'approver_id' });
Request.belongsTo(Employee, { as: 'decider', foreignKey: 'decided_by' });
Activity.belongsTo(Employee, { as: 'actor', foreignKey: 'actor_id' });
Request.hasMany(Activity, { as: 'activities', foreignKey: 'request_id' });
