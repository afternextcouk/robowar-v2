import 'dotenv/config';
import { Worker, Queue, QueueScheduler, Job } from 'bullmq';
import { PrismaClient } from '@prisma/client';

// ──────────────────────────────────────────────
// Constants
// ──────────────────────────────────────────────
export type RobotTier = 'FREE' | 'COMMON' | 'RARE' | 'EPIC' | 'LEGENDARY';

/**
 * Energy recharge intervals (milliseconds) per tier.
 * After this duration, the robot gets +1 energy point.
 */
export const RECHARGE_INTERVAL_MS: Record<RobotTier, number> = {
  FREE:      4 * 60 * 60 * 1000, // 4 hours
  COMMON:    3 * 60 * 60 * 1000, // 3 hours
  RARE:      2 * 60 * 60 * 1000, // 2 hours
  EPIC:      1 * 60 * 60 * 1000, // 1 hour
  LEGENDARY: 1 * 60 * 60 * 1000, // 1 hour
};

export const MAX_ENERGY: Record<RobotTier, number> = {
  FREE:      3,
  COMMON:    5,
  RARE:      7,
  EPIC:      10,
  LEGENDARY: 10,
};

const QUEUE_NAME = 'energy-recharge';
const JOB_NAME   = 'recharge-all-robots';
const REPEAT_CRON = '*/15 * * * *'; // Check every 15 minutes

// ──────────────────────────────────────────────
// Redis Connection Options
// ──────────────────────────────────────────────
const redisConnection = {
  host: process.env.REDIS_HOST || 'localhost',
  port: Number(process.env.REDIS_PORT) || 6379,
  password: process.env.REDIS_PASSWORD || undefined,
};

// ──────────────────────────────────────────────
// Prisma Client
// ──────────────────────────────────────────────
const prisma = new PrismaClient();

// ──────────────────────────────────────────────
// Queue & Scheduler
// ──────────────────────────────────────────────
export const energyQueue = new Queue(QUEUE_NAME, {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 5000 },
    removeOnComplete: 100,
    removeOnFail: 50,
  },
});

// ──────────────────────────────────────────────
// Worker: Process energy recharge for all robots
// ──────────────────────────────────────────────
export const energyWorker = new Worker(
  QUEUE_NAME,
  async (job: Job) => {
    console.log(`[EnergyRecharge] Processing job: ${job.id} at ${new Date().toISOString()}`);

    // Fetch all robots that are not at max energy
    // We use raw query for efficiency; Prisma doesn't support computed fields in WHERE
    const robots = await prisma.robot.findMany({
      where: {
        // energy below max — we'll check per-robot in loop
        isActive: true,
      },
      select: {
        id: true,
        tier: true,
        energy: true,
        lastEnergyRechargeAt: true,
      },
    });

    let rechargedCount = 0;
    const now = new Date();

    for (const robot of robots) {
      const tier = robot.tier as RobotTier;
      const maxEnergy = MAX_ENERGY[tier] ?? 3;
      const intervalMs = RECHARGE_INTERVAL_MS[tier] ?? RECHARGE_INTERVAL_MS.FREE;

      if (robot.energy >= maxEnergy) continue;

      const lastRecharge = robot.lastEnergyRechargeAt ?? new Date(0);
      const msSinceRecharge = now.getTime() - lastRecharge.getTime();

      // How many full intervals have passed?
      const intervalsElapsed = Math.floor(msSinceRecharge / intervalMs);
      if (intervalsElapsed < 1) continue;

      const energyToAdd = Math.min(intervalsElapsed, maxEnergy - robot.energy);
      const newEnergy   = robot.energy + energyToAdd;

      await prisma.$transaction([
        prisma.robot.update({
          where: { id: robot.id },
          data: {
            energy: newEnergy,
            lastEnergyRechargeAt: now,
          },
        }),
        prisma.energyLog.create({
          data: {
            robotId:   robot.id,
            delta:     energyToAdd,
            reason:    'RECHARGE',
            energyAfter: newEnergy,
            createdAt: now,
          },
        }),
      ]);

      rechargedCount++;
      console.log(`[EnergyRecharge] Robot ${robot.id} (${tier}): +${energyToAdd} energy → ${newEnergy}/${maxEnergy}`);
    }

    console.log(`[EnergyRecharge] Done. Recharged ${rechargedCount}/${robots.length} robots.`);
    return { rechargedCount, total: robots.length, processedAt: now.toISOString() };
  },
  {
    connection: redisConnection,
    concurrency: 1, // Single worker — prevents double-recharge races
  }
);

// ──────────────────────────────────────────────
// Worker Event Handlers
// ──────────────────────────────────────────────
energyWorker.on('completed', (job) => {
  console.log(`[EnergyRecharge] ✅ Job ${job.id} completed`);
});

energyWorker.on('failed', (job, err) => {
  console.error(`[EnergyRecharge] ❌ Job ${job?.id} failed:`, err.message);
});

energyWorker.on('error', (err) => {
  console.error('[EnergyRecharge] Worker error:', err);
});

// ──────────────────────────────────────────────
// Schedule Recurring Job
// ──────────────────────────────────────────────
export async function scheduleEnergyRechargeJob(): Promise<void> {
  // Remove existing repeatable jobs to avoid duplicates on restart
  const repeatableJobs = await energyQueue.getRepeatableJobs();
  for (const job of repeatableJobs) {
    if (job.name === JOB_NAME) {
      await energyQueue.removeRepeatableByKey(job.key);
      console.log(`[EnergyRecharge] Removed existing repeatable job: ${job.key}`);
    }
  }

  await energyQueue.add(
    JOB_NAME,
    { triggeredBy: 'scheduler' },
    {
      repeat: { pattern: REPEAT_CRON },
    }
  );

  console.log(`[EnergyRecharge] Scheduled recurring job: ${REPEAT_CRON}`);
}

// ──────────────────────────────────────────────
// Standalone entry point (run via `npm run worker`)
// ──────────────────────────────────────────────
if (require.main === module) {
  console.log('[EnergyRecharge] Starting standalone worker...');
  scheduleEnergyRechargeJob()
    .then(() => console.log('[EnergyRecharge] Worker ready & job scheduled'))
    .catch(console.error);

  // Graceful shutdown
  process.on('SIGTERM', async () => {
    console.log('[EnergyRecharge] SIGTERM received, shutting down...');
    await energyWorker.close();
    await energyQueue.close();
    await prisma.$disconnect();
    process.exit(0);
  });
}
