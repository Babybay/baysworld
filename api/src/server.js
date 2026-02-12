const app = require('./app');

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`\n  ╔══════════════════════════════════════╗`);
  console.log(`  ║   BaysWorld v2.0 — Portfolio & KB     ║`);
  console.log(`  ║   Running on http://localhost:${PORT}     ║`);
  console.log(`  ╚══════════════════════════════════════╝\n`);
});
