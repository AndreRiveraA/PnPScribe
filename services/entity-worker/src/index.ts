import "dotenv/config";

import { Worker } from "bullmq";

import { config } from "./config.js";
import { pool } from "./db.js";
import { processEntityJobSafely } from "./processor.js";
import type { EntityExtractionJobPayload } from "./types.js";

function createRedisConnectionOptions() {
  const url = new URL(config.redisUrl);
  return {
    host: url.hostname,
    port: url.port ? Number(url.port) : 6379,
    username: url.username || undefined,
    password: url.password || undefined,
    db: url.pathname && url.pathname !== "/" ? Number(url.pathname.slice(1)) : undefined,
    maxRetriesPerRequest: null as null,
  };
}

const connection = createRedisConnectionOptions();
let isShuttingDown = false;
let forcedExitTimer: NodeJS.Timeout | null = null;

function summarizeRedisUrl(urlString: string) {
  try {
    const url = new URL(urlString);
    const db = url.pathname && url.pathname !== "/" ? url.pathname.slice(1) : "0";
    return `${url.protocol}//${url.hostname}:${url.port || "6379"}/${db}`;
  } catch {
    return "(invalid REDIS_URL)";
  }
}

console.log("[entity-worker] booting...");
console.log("[entity-worker] config", {
  queue: config.entityQueueName,
  redis: summarizeRedisUrl(config.redisUrl),
  projectRoot: config.projectRoot,
  entityModel: config.entityModel,
  hasDatabaseUrl: Boolean(config.databaseUrl),
  hasOpenAiApiKey: Boolean(config.openAiApiKey),
});

const worker = new Worker<EntityExtractionJobPayload>(
  config.entityQueueName,
  async (job) => {
    const startedAt = Date.now();

    if (job.name !== "entity-extraction") {
      throw new Error(`Unsupported entity job type: ${job.name}`);
    }

    console.log("[entity-worker] job start", {
      id: job.id,
      name: job.name,
      attemptsMade: job.attemptsMade,
      documentId: job.data.documentId,
      requestedAt: job.data.requestedAt,
    });

    const result = await processEntityJobSafely(job.data);

    console.log("[entity-worker] job end", {
      id: job.id,
      durationMs: Date.now() - startedAt,
      result,
    });

    return result;
  },
  {
    connection,
    concurrency: 1,
    lockDuration: 5 * 60 * 1000,
  },
);

worker.on("ready", () => {
  console.log(`[entity-worker] worker ready (queue=${config.entityQueueName})`);
  console.log("[entity-worker] redis target", summarizeRedisUrl(config.redisUrl));
});

worker.on("active", (job) => {
  console.log("[entity-worker] active", {
    id: job.id,
    name: job.name,
    documentId: (job.data as EntityExtractionJobPayload).documentId,
  });
});

worker.on("stalled", (jobId) => {
  console.warn("[entity-worker] stalled", { jobId });
});

worker.on("progress", (job, progress) => {
  console.log("[entity-worker] bullmq progress", {
    id: job.id,
    progress,
  });
});

worker.on("completed", (job, result) => {
  console.log(`[entity-worker] completed job ${job.id}`, result);
});

worker.on("failed", (job, error) => {
  console.error(`[entity-worker] failed job ${job?.id ?? "unknown"}`, {
    name: job?.name,
    attemptsMade: job?.attemptsMade,
    documentId: (job?.data as EntityExtractionJobPayload | undefined)?.documentId,
    error,
  });
});

async function shutdown(signal: string) {
  if (isShuttingDown) {
    console.log(`[entity-worker] shutdown already in progress (${signal})`);
    return;
  }

  isShuttingDown = true;
  console.log(`[entity-worker] shutting down (${signal})`);

  forcedExitTimer = setTimeout(() => {
    console.error("[entity-worker] forced shutdown timeout reached, exiting");
    process.exit(1);
  }, 10_000);

  try {
    await worker.close(false);
  } catch (error) {
    console.error("[entity-worker] error while closing worker", error);
  }

  try {
    await pool.end();
  } catch (error) {
    console.error("[entity-worker] error while closing postgres pool", error);
  }

  if (forcedExitTimer) {
    clearTimeout(forcedExitTimer);
  }

  console.log("[entity-worker] shutdown complete");
  process.exit(0);
}

process.on("SIGINT", () => {
  void shutdown("SIGINT");
});
process.on("SIGTERM", () => {
  void shutdown("SIGTERM");
});
