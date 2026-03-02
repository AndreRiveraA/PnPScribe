import "server-only";

import { prisma } from "@/lib/prisma";
import { ENTITY_QUEUE_NAME } from "@/lib/server/entity-queue";
import { OCR_QUEUE_NAME } from "@/lib/server/ocr-queue";
import { Queue } from "bullmq";

const redisUrl = process.env.REDIS_URL ?? "redis://127.0.0.1:6379";

function createConnectionOptions() {
  const url = new URL(redisUrl);
  return {
    host: url.hostname,
    port: url.port ? Number(url.port) : 6379,
    username: url.username || undefined,
    password: url.password || undefined,
    db: url.pathname && url.pathname !== "/" ? Number(url.pathname.slice(1)) : undefined,
    maxRetriesPerRequest: null as null,
  };
}

async function clearQueue(name: string) {
  const queue = new Queue(name, { connection: createConnectionOptions() });
  try {
    await queue.obliterate({ force: true });
  } finally {
    await queue.close();
  }
}

export async function resetQueuesAndStatus() {
  await Promise.all([clearQueue(OCR_QUEUE_NAME), clearQueue(ENTITY_QUEUE_NAME)]);

  await prisma.document.updateMany({
    data: {
      ocrStatus: "not_requested",
      ocrMode: null,
      ocrReason: null,
      ocrError: null,
      ocrRequestedAt: null,
      ocrCompletedAt: null,
      ocrProgressCurrentPage: null,
      ocrProgressTotalPages: null,
      ocrProgressMessage: null,
      ocrProgressUpdatedAt: null,
      entityStatus: "idle",
      entityError: null,
      entityProgressMessage: null,
      entityProgressUpdatedAt: null,
      entityExtractedCount: 0,
      entityRuleLinkCount: 0,
      entityImageCount: 0,
    },
  });

  return { ok: true };
}
