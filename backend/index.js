import { app } from './app.js';
import { env } from './config/env.js';
import { sequelize } from './config/database.js';
try {
  await sequelize.authenticate();
  const server = app.listen(env.port, '127.0.0.1', () => console.log(`API ready at http://localhost:${env.port}`));
  for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => server.close(async () => { await sequelize.close(); process.exit(0); }));
} catch (error) { console.error('Database unavailable. Check the DB_* settings in .env and start PostgreSQL.', error.message); process.exitCode = 1; }
