import "server-only";

import { Prisma } from "@prisma/client";

import { MODELS, openai } from "@/lib/openai";
import { prisma } from "@/lib/prisma";

interface ChunkRow {
  id: string;
  content: string;
}

function toVectorLiteral(values: number[]) {
  return `[${values.join(",")}]`;
}

async function listChunksMissingEmbeddings(documentId: string): Promise<ChunkRow[]> {
  const rows = await prisma.$queryRaw<Array<{ id: string; content: string }>>(
    Prisma.sql`
      SELECT "id", "content"
      FROM "Chunk"
      WHERE "documentId" = ${documentId}
        AND "embedding" IS NULL
      ORDER BY "createdAt" ASC
    `,
  );

  return rows.map((row) => ({
    id: row.id,
    content: row.content,
  }));
}

async function updateChunkEmbedding(chunkId: string, embedding: number[]) {
  const vectorLiteral = toVectorLiteral(embedding);

  await prisma.$executeRaw(
    Prisma.sql`
      UPDATE "Chunk"
      SET "embedding" = CAST(${vectorLiteral} AS vector)
      WHERE "id" = ${chunkId}
    `,
  );
}

export async function embedMissingChunksForDocument(documentId: string) {
  const chunks = await listChunksMissingEmbeddings(documentId);
  if (chunks.length === 0) {
    return { embeddedCount: 0 };
  }

  const batchSize = 32;
  let embeddedCount = 0;

  for (let i = 0; i < chunks.length; i += batchSize) {
    const batch = chunks.slice(i, i + batchSize);

    const response = await openai.embeddings.create({
      model: MODELS.embed,
      input: batch.map((chunk) => chunk.content),
    });

    for (let j = 0; j < batch.length; j += 1) {
      const vector = response.data[j]?.embedding;
      if (!Array.isArray(vector) || vector.length === 0) {
        throw new Error(`Missing embedding vector for chunk ${batch[j]?.id ?? "unknown"}.`);
      }

      await updateChunkEmbedding(batch[j]!.id, vector);
      embeddedCount += 1;
    }
  }

  return { embeddedCount };
}
