require('dotenv').config();

const app = require('./app');
const initDB = require('./services/init-db');

const PORT = process.env.PORT || 3000;

async function start() {
  try {
    await initDB();
  } catch (err) {
    console.warn('⚠  DB init warning:', err.message);
    console.warn('⚠  Server will start but some features may not work until DB is available.');
  }

  app.listen(PORT, () => {
    console.log(`\n  ╔══════════════════════════════════════╗`);
    console.log(`  ║   BaysWorld v2.0 — Portfolio & KB     ║`);
    console.log(`  ║   Running on http://localhost:${PORT}     ║`);
    console.log(`  ║   Database: PostgreSQL                ║`);
    console.log(`  ╚══════════════════════════════════════╝\n`);
  });
}

start();
