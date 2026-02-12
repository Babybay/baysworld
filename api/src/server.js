require('dotenv').config();

const app = require('./app');
const initDB = require('./services/init-db');

const PORT = process.env.PORT || 3000;

async function start() {
  try {
    await initDB();
    app.listen(PORT, () => {
      console.log(`\n  ╔══════════════════════════════════════╗`);
      console.log(`  ║   BaysWorld v2.0 — Portfolio & KB     ║`);
      console.log(`  ║   Running on http://localhost:${PORT}     ║`);
      console.log(`  ║   Database: PostgreSQL ✅              ║`);
      console.log(`  ╚══════════════════════════════════════╝\n`);
    });
  } catch (err) {
    console.error('Failed to start server:', err.message);
    process.exit(1);
  }
}

start();
