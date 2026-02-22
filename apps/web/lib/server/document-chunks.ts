import "server-only";

import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { HttpError } from "@/lib/server/http-error";

export function parseDocumentId(input: unknown) {
  const documentId = typeof input === "string" ? input.trim() : "";

  if (!documentId) {
    throw new HttpError(400, "documentId is required.");
  }

  return documentId;
}

interface ChunkDebugRow {
  id: string;
  chunkIndex: number;
  pageNumber: number | null;
  chapterHint: string | null;
  content: string;
  hasEmbedding: boolean;
  createdAt: Date;
}

export async function listChunksForDocument(documentId: string) {
  const document = await prisma.document.findUnique({
    where: { id: documentId },
    select: {
      id: true,
      filePath: true,
      systemId: true,
      extractedTextLength: true,
      extractedPageCount: true,
      extractionDurationMs: true,
      ocrStatus: true,
      ocrReason: true,
      ocrError: true,
      ocrRequestedAt: true,
      ocrCompletedAt: true,
      extractionStatus: true,
      extractionError: true,
      extractedAt: true,
      createdAt: true,
      _count: {
        select: {
          chunks: true,
        },
      },
    },
  });

  if (!document) {
    throw new HttpError(404, "Document not found.");
  }

  const chunks = await prisma.$queryRaw<ChunkDebugRow[]>(
    Prisma.sql`
      SELECT
        c."id",
        c."chunkIndex",
        c."pageNumber",
        c."chapterHint",
        c."content",
        (c."embedding" IS NOT NULL) AS "hasEmbedding",
        c."createdAt"
      FROM "Chunk" c
      WHERE c."documentId" = ${documentId}
      ORDER BY c."chunkIndex" ASC, c."createdAt" ASC
    `,
  );

  return {
    document,
    chunks,
  };
}
