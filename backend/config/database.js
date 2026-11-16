import { Sequelize } from 'sequelize';
import { env } from './env.js';
export const sequelize = new Sequelize(env.database.name, env.database.user, env.database.password, {
  dialect: 'postgres',
  host: env.database.host,
  port: env.database.port,
  logging: env.dbLogging ? console.log : false,
  define: { timestamps: false },
  pool: { max: 10 },
});
