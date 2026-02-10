const { Worker } = require('bullmq');
const IORedis = require('ioredis');
const { Pool } = require('pg');
const { spawnSync } = require('child_process');

// ================= REDIS =================
const connection = new IORedis({
  host: 'localhost',
  port: 6379,
  maxRetriesPerRequest: null,
});

// HEARTBEAT
setInterval(() => {
  connection.set('status:worker-runtime', 'ok', 'EX', 10);
}, 5000);

// ================= POSTGRES =================
const pool = new Pool({
  user: 'postgres',
  host: 'localhost',
  database: 'baysworld',
  password: 'babybay',
  port: 5433,
});

// ================= WORKER =================
new Worker(
  'runtime-queue',
  async (job) => {
    const { appId, userId, imageName } = job.data;

    console.log('🚀 RUN START:', appId);

    if (!appId || !imageName) {
      throw new Error('Invalid runtime payload');
    }

    // --- CEK DB ---
    const result = await pool.query(
      'SELECT status FROM apps WHERE id=$1',
      [appId]
    );

    if (result.rowCount === 0) {
      throw new Error(`App ${appId} not found in DB`);
    }

    // --- CONTAINER NAME ---
    const containerName = `app_${userId}_${appId}`;

    // --- RUN CONTAINER (TRAEFIK READY) ---
    const run = spawnSync(
      'docker',
      [
        'run',
        '-d',
        '--name', containerName,

        // 🔐 SANDBOX
        '--read-only',
        '--cap-drop=ALL',
        '--pids-limit=50',
        '--memory=512m',
        '--cpus=0.5',
        '--security-opt=no-new-privileges',

        // TRAEFIK
        '--label', 'traefik.enable=true',
        '--label', `traefik.http.routers.app_${appId}.rule=PathPrefix(\\\`/app/${appId}\\\`)`,
        '--label', `traefik.http.routers.app_${appId}.entrypoints=web`,
        '--label', `traefik.http.services.app_${appId}.loadbalancer.server.port=3000`,
        '--label', `traefik.http.middlewares.app_${appId}_strip.stripprefix.prefixes=/app/${appId}`,
        '--label', `traefik.http.routers.app_${appId}.middlewares=app_${appId}_strip`,


        imageName,
      ],
      { stdio: 'inherit' }
    );


    if (run.status !== 0) {
      await pool.query(
        `UPDATE apps SET status='failed' WHERE id=$1`,
        [appId]
      );
      throw new Error('Docker run failed');
    }

    // --- UPDATE DB (RUNNING) ---
    await pool.query(
      `UPDATE apps
       SET container_name=$1, status='running'
       WHERE id=$2`,
      [containerName, appId]
    );

    console.log(`✅ APP RUNNING: http://localhost/app/${appId}`);
  },
  { connection }
);

console.log('🏃 worker-runtime READY');
