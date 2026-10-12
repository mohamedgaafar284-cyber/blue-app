/**
 * BullMQ Job Queue Module
 *
 * Provides centralized queue management for background job processing.
 * Queues are used for email sending, notifications, automations, report
 * generation, and cleanup tasks.
 *
 * Usage:
 *   import { getQueue, QUEUES } from '@/lib/queue';
 *
 *   const emailQueue = getQueue(QUEUES.EMAIL);
 *   await emailQueue.add('send-welcome', { to: 'user@example.com', ... });
 */

import { Queue, Worker, Job } from 'bullmq';
import { getSharedRedisConnection } from './redis';
import { log } from '@/lib/logger';
import { registerShutdownCallback } from '../shutdown';

// ============================================
// Queue Name Definitions
// ============================================

export const QUEUES = {
  EMAIL: 'email',
  NOTIFICATION: 'notification',
  AUTOMATION: 'automation',
  REPORT: 'report',
  CLEANUP: 'cleanup',
} as const;

export type QueueName = typeof QUEUES[keyof typeof QUEUES];

// ============================================
// Queue Default Options
// ============================================

const DEFAULT_QUEUE_OPTIONS = {
  defaultJobOptions: {
    removeOnComplete: {
      count: 1000, // Keep last 1000 completed jobs
      age: 24 * 3600, // Remove after 24 hours
    },
    removeOnFail: {
      count: 5000, // Keep last 5000 failed jobs for debugging
    },
    attempts: 3,
    backoff: {
      type: 'exponential' as const,
      delay: 1000, // 1s, 2s, 4s
    },
  },
};

// ============================================
// Queue Instances Cache
// ============================================

const queueCache = new Map<string, Queue>();

/**
 * Get or create a BullMQ Queue by name.
 * Queues are cached to avoid creating duplicate connections.
 *
 * @param name - The queue name (use QUEUES constants)
 * @returns A BullMQ Queue instance
 */
export function getQueue(name: QueueName): Queue {
  const existing = queueCache.get(name);
  if (existing) {
    return existing;
  }

  const connection = getSharedRedisConnection();
  const queue = new Queue(name, {
    connection: connection as any,
    ...DEFAULT_QUEUE_OPTIONS,
  });

  queueCache.set(name, queue);

  log.info(`[Queue] Queue "${name}" created`);

  return queue;
}

// ============================================
// Worker Management
// ============================================

interface WorkerRegistry {
  [queueName: string]: Worker;
}

const activeWorkers: WorkerRegistry = {};

/**
 * Worker status information
 */
export interface WorkerStatus {
  queueName: string;
  isRunning: boolean;
  isPaused: boolean;
  jobsProcessed: number;
  jobsFailed: number;
}

/**
 * Create and start a worker for a given queue.
 *
 * If a worker is already registered for this queue, it is closed (awaited)
 * before the new one is started. Awaiting the close prevents a race condition
 * where the old worker could still be processing a job while the new one
 * starts consuming from the same queue (which would cause duplicate
 * processing of in-flight jobs).
 *
 * NOTE: Callers that only want to ensure a worker is running should prefer
 * `startAllWorkers()` — it is idempotent and will NOT restart an already
 * running worker.
 *
 * @param queueName - The queue to consume from
 * @param processor - The job processing function
 * @param concurrency - Number of concurrent jobs (default: 1)
 * @returns The Worker instance
 */
export async function startWorker(
  queueName: QueueName,
  processor: (job: Job) => Promise<void>,
  concurrency: number = 1
): Promise<Worker> {
  // If a worker already exists for this queue, close it FIRST and await the
  // close to guarantee the old worker has fully stopped (no in-flight jobs,
  // no Redis subscriptions) before we start a new one. Previously this was
  // fire-and-forget which caused duplicate processing during the overlap
  // window.
  if (activeWorkers[queueName]) {
    log.warn(`[Queue] Worker for "${queueName}" already exists — closing old worker (awaited)`);
    try {
      await activeWorkers[queueName].close();
    } catch (error) {
      log.error(`[Queue] Error closing old worker for "${queueName}":`, error);
    }
    delete activeWorkers[queueName];
  }

  const connection = getSharedRedisConnection();

  const worker = new Worker(queueName, processor, {
    connection: connection as any,
    concurrency,
    limiter: {
      max: 10, // Max 10 jobs
      duration: 1000, // Per second
    },
  });

  worker.on('completed', (job: Job) => {
    log.info(`[Queue] Job completed`, {
      queue: queueName,
      jobId: job.id,
      jobName: job.name,
    });
  });

  worker.on('failed', async (job: Job | undefined, err: Error) => {
    log.error(`[Queue] Job failed`, err, {
      queue: queueName,
      jobId: job?.id,
      jobName: job?.name,
      attemptsMade: job?.attemptsMade,
    });

    // P2-34 FIX: Dead Letter Queue (DLQ).
    // When a job exhausts all retry attempts (attemptsMade >= opts.attempts),
    // move it to a `<queueName>-dlq` queue for manual inspection/alerting.
    // This prevents permanently failed jobs from being silently lost in the
    // `removeOnFail` cleanup.
    if (job && job.attemptsMade >= (DEFAULT_QUEUE_OPTIONS.defaultJobOptions.attempts || 3)) {
      try {
        const dlqQueue = getQueue(`${queueName}-dlq` as QueueName);
        await dlqQueue.add(job.name, {
          originalQueue: queueName,
          originalJobId: job.id,
          originalData: job.data,
          error: err.message,
          failedAt: new Date().toISOString(),
          attemptsMade: job.attemptsMade,
        }, {
          // DLQ jobs are not retried automatically — they need manual intervention.
          attempts: 1,
          removeOnComplete: { count: 1000, age: 30 * 24 * 3600 }, // Keep 30 days
          removeOnFail: { count: 5000 },
        });
        log.warn(`[Queue] Job moved to DLQ`, {
          queue: queueName,
          jobId: job.id,
          dlq: `${queueName}-dlq`,
        });
      } catch (dlqError) {
        log.error(`[Queue] Failed to move job to DLQ`, dlqError, {
          queue: queueName,
          jobId: job.id,
        });
      }
    }
  });

  worker.on('error', (err: Error) => {
    log.error(`[Queue] Worker error`, err, { queue: queueName });
  });

  activeWorkers[queueName] = worker;

  log.info(`[Queue] Worker started for "${queueName}" (concurrency: ${concurrency})`);

  return worker;
}

/**
 * Get status of all active workers
 */
export async function getWorkersStatus(): Promise<WorkerStatus[]> {
  const statuses: WorkerStatus[] = [];

  for (const [queueName, worker] of Object.entries(activeWorkers)) {
    const isRunning = worker.isRunning();
    const isPaused = worker.isPaused();

    statuses.push({
      queueName,
      isRunning,
      isPaused,
      jobsProcessed: 0, // BullMQ doesn't expose this directly
      jobsFailed: 0,
    });
  }

  return statuses;
}

/**
 * Close all active workers gracefully
 */
export async function closeAllWorkers(): Promise<void> {
  const closePromises = Object.entries(activeWorkers).map(async ([name, worker]) => {
    try {
      await worker.close();
      log.info(`[Queue] Worker for "${name}" closed`);
    } catch (error) {
      log.error(`[Queue] Error closing worker for "${name}":`, error);
    }
  });

  await Promise.all(closePromises);

  // Clear the registry
  for (const key of Object.keys(activeWorkers)) {
    delete activeWorkers[key];
  }
}

/**
 * Start all workers with their respective processors.
 *
 * IDEMPOTENT: Vercel cron invokes the /api/cron/workers endpoint every
 * five minutes (see the schedule entry in vercel.json). Previously this
 * restarted every worker on each call, interrupting in-flight jobs every
 * five minutes. Now we skip any worker that is already registered AND
 * running — only workers that are missing or not running are (re)started.
 *
 * This is called by the /api/cron/workers endpoint.
 */
export async function startAllWorkers(): Promise<void> {
  // Dynamic imports to avoid circular dependencies
  const { emailProcessor } = await import('./processors/email');
  const { notificationProcessor } = await import('./processors/notification');
  const { automationProcessor } = await import('./processors/automation');
  const { reportProcessor } = await import('./processors/report');
  const { cleanupProcessor } = await import('./processors/cleanup');

  // [queueName, processor, concurrency]
  const workerConfigs: Array<[QueueName, (job: Job) => Promise<void>, number]> = [
    [QUEUES.EMAIL, emailProcessor, 5],
    [QUEUES.NOTIFICATION, notificationProcessor, 10],
    [QUEUES.AUTOMATION, automationProcessor, 3],
    [QUEUES.REPORT, reportProcessor, 2],
    [QUEUES.CLEANUP, cleanupProcessor, 2],
  ];

  let startedCount = 0;
  let skippedCount = 0;

  for (const [queueName, processor, concurrency] of workerConfigs) {
    const existing = activeWorkers[queueName];

    if (existing && typeof existing.isRunning === 'function' && existing.isRunning()) {
      // Worker already running — do NOT restart (idempotent). Restarting
      // would close the existing worker and interrupt any in-flight jobs.
      log.info(`[Queue] Worker for "${queueName}" already running — skipping (idempotent start)`);
      skippedCount++;
      continue;
    }

    if (existing) {
      // Worker registered but NOT running (crashed, closed, or paused) —
      // clean up the stale reference before starting a fresh one.
      log.warn(`[Queue] Worker for "${queueName}" registered but not running — restarting`);
      try {
        await existing.close();
      } catch (error) {
        log.error(`[Queue] Error closing stale worker for "${queueName}":`, error);
      }
      delete activeWorkers[queueName];
    }

    await startWorker(queueName, processor, concurrency);
    startedCount++;
  }

  log.info(`[Queue] startAllWorkers complete — ${startedCount} started, ${skippedCount} already running`);
}

// ============================================
// Job Helpers
// ============================================

/**
 * Add a job to a queue with a typed payload.
 * This is a convenience wrapper around queue.add().
 */
export async function addJob(
  queueName: QueueName,
  jobName: string,
  data: Record<string, unknown>,
  options?: {
    priority?: number;
    delay?: number;
    attempts?: number;
  }
): Promise<Job> {
  const queue = getQueue(queueName);

  const job = await queue.add(jobName, data, {
    priority: options?.priority,
    delay: options?.delay,
    attempts: options?.attempts,
  });

  log.info(`[Queue] Job added`, {
    queue: queueName,
    jobName,
    jobId: job.id,
  });

  return job;
}

/**
 * Check if BullMQ (Redis) is available for durable queueing.
 * Used by callers to decide whether to use BullMQ or fall back to in-memory.
 */
export function isRedisAvailable(): boolean {
  return !!process.env.REDIS_URL;
}

// Register with graceful shutdown manager
declare global {
  var __queueShutdownRegistered: boolean | undefined;
}

if (typeof window === 'undefined' && !globalThis.__queueShutdownRegistered) {
  globalThis.__queueShutdownRegistered = true;
  registerShutdownCallback('BullMQ Workers Close', async () => {
    log.info('[Queue] Shutting down queue workers gracefully...');
    await closeAllWorkers();
  });
}

