const { Worker, Queue } = require('bullmq');
const IORedis = require('ioredis');
const AdmZip = require('adm-zip');
const yaml = require('js-yaml');
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const { Pool } = require('pg');

const connection = new IORedis({
    host: 'localhost',
    port: 6379,
    maxRetriesPerRequest: null,
});

const pool = new Pool({
    user: 'postgres',
    host: 'localhost',
    database: 'baysworld',
    password: 'babybay',
    port: 5433,
});

// HEARTBEAT
setInterval(() => {
    connection.set('status:worker-build', 'ok', 'EX', 10);
}, 5000);

const TMP_ROOT = path.join(__dirname, 'tmp');
const runtimeQueue = new Queue('runtime-queue', { connection });

new Worker(
    'build-queue',
    async (job) => {
        const { appId, userId, zipPath } = job.data;

        console.log(`🚧 Building app ${appId} for user ${userId}`);

        await pool.query(
            "UPDATE apps SET status='building' WHERE id=$1",
            [appId]
        );

        const buildDir = path.join(TMP_ROOT, `app_${appId}`);
        fs.mkdirSync(buildDir, { recursive: true });

        // 1️⃣ Extract ZIP
        const zip = new AdmZip(zipPath);
        zip.extractAllTo(buildDir, true);

        // 2️⃣ Load app.yaml
        const yamlPath = path.join(buildDir, 'app.yaml');
        if (!fs.existsSync(yamlPath)) {
            throw new Error('app.yaml not found');
        }

        const config = yaml.load(fs.readFileSync(yamlPath, 'utf8'));

        if (config.runtime !== 'node') {
            throw new Error(`Unsupported runtime: ${config.runtime}`);
        }

        // 3️⃣ Copy Dockerfile
        const dockerfileSrc = path.join(__dirname, 'docker', 'node.Dockerfile');
        const dockerfileDest = path.join(buildDir, 'Dockerfile');
        fs.copyFileSync(dockerfileSrc, dockerfileDest);

        // 4️⃣ Docker build
        const imageName = `baysworld_app_${userId}_${appId}`;
        console.log(`🐳 docker build ${imageName}`);

        const build = spawnSync(
            'docker',
            ['build', '-t', imageName, '.'],
            {
                cwd: buildDir,
                stdio: 'inherit',
                timeout: 15 * 60 * 1000, // 15 menit
            }
        );

        if (build.error && build.error.code === 'ETIMEDOUT') {
            await pool.query(
                `UPDATE apps SET status='failed' WHERE id=$1`,
                [appId]
            );
            throw new Error('Build timeout');
        }


        if (build.status !== 0) {
            await pool.query(
                `UPDATE apps SET status='failed' WHERE id=$1`,
                [appId]
            );
            throw new Error('Docker build failed');
        }

        console.log(`✅ Build success: ${imageName}`);

        // 🔥 ENQUEUE RUNTIME JOB — DI SINI DAN HANYA DI SINI
        await runtimeQueue.add('run-app', {
            imageName,
            appId,
            userId,
        });

        async function log(appId, msg) {
            await pool.query(
                'INSERT INTO build_logs (app_id, message) VALUES ($1, $2)',
                [appId, msg]
            );
        }
        await log(appId, 'Build started');
        await log(appId, 'Docker build success');
        await log(appId, 'Sent to runtime queue');
        await log(appId, 'Build failed');

        console.log('➡️ Sent to runtime queue');

        return { imageName };
    },
    { connection }
);

console.log('👷 Build worker started');
