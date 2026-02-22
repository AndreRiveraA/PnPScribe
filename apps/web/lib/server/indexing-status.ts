import "server-only";

import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { HttpError } from "@/lib/server/http-error";

interface IndexingStatusRow {
  documentId: string;
  filePath: string;
  extractionStatus: string;
  extractionError: string | null;
  chunkCount: bigint | number;
  embeddedCount: bigint | number;
}

function toNumber(value: bigint | number) {
  return typeof value === "bigint" ? Number(value) : value;
}

export async function getSystemIndexingStatus(systemId: string) {
  const system = await prisma.system.findUnique({
    where: { id: systemId },
    select: { id: true, name: true },
  });

  if (!system) {
    throw new HttpError(404, "System not found.");
  }

  const rows = await prisma.$queryRaw<IndexingStatusRow[]>(
    Prisma.sql`
      SELECT
        d."id" AS "documentId",
        d."filePath",
        d."extractionStatus",
        d."extractionError",
        COUNT(c."id") AS "chunkCount",
        COUNT(c."id") FILTER (WHERE c."embedding" IS NOT NULL) AS "embeddedCount"
      FROM "Document" d
      LEFT JOIN "Chunk" c ON c."documentId" = d."id"
      WHERE d."systemId" = ${systemId}
      GROUP BY d."id"
      ORDER BY d."createdAt" DESC
    `,
  );

  const documents = rows.map((row) => ({
    documentId: row.documentId,
    filePath: row.filePath,
    extractionStatus: row.extractionStatus,
    extractionError: row.extractionError,
    chunkCount: toNumber(row.chunkCount),
    embeddedCount: toNumber(row.embeddedCount),
  }));

  return {
    system,
    totals: {
      documents: documents.length,
      chunks: documents.reduce((sum, doc) => sum + doc.chunkCount, 0),
      embeddedChunks: documents.reduce((sum, doc) => sum + doc.embeddedCount, 0),
    },
    documents,
  };
}
