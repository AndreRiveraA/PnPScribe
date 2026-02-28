import { randomUUID } from "node:crypto";

import { Pool } from "pg";

import { config } from "./config.js";

export const pool = new Pool({
  connectionString: config.databaseUrl,
});

export interface DocumentRecord {
  id: string;
  systemId: string;
  filePath: string;
  entityStatus: string | null;
}

export interface ChunkGroupRecord {
  id: string;
  kind: string;
  title: string | null;
  chapterHint: string | null;
  startChunkIndex: number;
  endChunkIndex: number;
  startPage: number | null;
  endPage: number | null;
}

export interface ChunkRecord {
  id: string;
  content: string;
  chunkIndex: number;
}

export async function getDocument(documentId: string) {
  const res = await pool.query<DocumentRecord>(
    `
    SELECT "id", "systemId", "filePath", "entityStatus"
    FROM "Document"
    WHERE "id" = $1
    `,
    [documentId],
  );

  return res.rows[0] ?? null;
}

export async function setEntityProcessing(documentId: string) {
  await pool.query(
    `
    UPDATE "Document"
    SET "entityStatus" = 'processing',
        "entityError" = NULL,
        "entityProgressMessage" = 'Entity extraction started',
        "entityProgressUpdatedAt" = NOW()
    WHERE "id" = $1
    `,
    [documentId],
  );
}

export async function setEntityFailed(documentId: string, message: string) {
  await pool.query(
    `
    UPDATE "Document"
    SET "entityStatus" = 'failed',
        "entityError" = $2,
        "entityProgressMessage" = 'Entity extraction failed',
        "entityProgressUpdatedAt" = NOW()
    WHERE "id" = $1
    `,
    [documentId, message.slice(0, 1000)],
  );
}

export async function setEntityProgress(documentId: string, params: {
  message: string;
  extractedCount: number;
  ruleLinkCount: number;
  imageCount: number;
}) {
  await pool.query(
    `
    UPDATE "Document"
    SET "entityProgressMessage" = $2,
        "entityProgressUpdatedAt" = NOW(),
        "entityExtractedCount" = $3,
        "entityRuleLinkCount" = $4,
        "entityImageCount" = $5
    WHERE "id" = $1
    `,
    [documentId, params.message.slice(0, 500), params.extractedCount, params.ruleLinkCount, params.imageCount],
  );
}

export async function setEntityCompleted(documentId: string, params: {
  extractedCount: number;
  ruleLinkCount: number;
  imageCount: number;
}) {
  await pool.query(
    `
    UPDATE "Document"
    SET "entityStatus" = 'completed',
        "entityError" = NULL,
        "entityProgressMessage" = 'Entity extraction complete',
        "entityProgressUpdatedAt" = NOW(),
        "entityExtractedCount" = $2,
        "entityRuleLinkCount" = $3,
        "entityImageCount" = $4
    WHERE "id" = $1
    `,
    [documentId, params.extractedCount, params.ruleLinkCount, params.imageCount],
  );
}

export async function listCandidateGroups(documentId: string) {
  const res = await pool.query<ChunkGroupRecord>(
    `
    SELECT "id", "kind", "title", "chapterHint", "startChunkIndex", "endChunkIndex", "startPage", "endPage"
    FROM "ChunkGroup"
    WHERE "documentId" = $1
      AND "kind" IN ('monster_section', 'item_section')
    ORDER BY "groupIndex" ASC
    `,
    [documentId],
  );

  return res.rows;
}

export async function listChunksForGroup(groupId: string) {
  const res = await pool.query<ChunkRecord>(
    `
    SELECT "id", "content", "chunkIndex"
    FROM "Chunk"
    WHERE "groupId" = $1
    ORDER BY "chunkIndex" ASC
    `,
    [groupId],
  );

  return res.rows;
}

export async function listNearbyChunks(documentId: string, start: number, end: number) {
  const res = await pool.query<ChunkRecord>(
    `
    SELECT "id", "content", "chunkIndex"
    FROM "Chunk"
    WHERE "documentId" = $1
      AND "chunkIndex" BETWEEN $2 AND $3
    ORDER BY "chunkIndex" ASC
    `,
    [documentId, start, end],
  );

  return res.rows;
}

export async function clearEntitiesForDocument(documentId: string) {
  await pool.query(
    `DELETE FROM "EntityRuleLink" WHERE "entityId" IN (SELECT "id" FROM "Entity" WHERE "documentId" = $1)`,
    [documentId],
  );
  await pool.query(`DELETE FROM "EntityImage" WHERE "documentId" = $1`, [documentId]);
  await pool.query(`DELETE FROM "Entity" WHERE "documentId" = $1`, [documentId]);
}

export async function upsertEntity(params: {
  systemId: string;
  documentId: string;
  groupId: string | null;
  type: string;
  name: string;
  slug: string;
  sourcePageStart: number | null;
  sourcePageEnd: number | null;
  sourceChunkStart: number;
  sourceChunkEnd: number;
  confidence: number;
  extractionMethod: string;
  coreData: Record<string, unknown>;
  rawData: Record<string, unknown> | null;
}) {
  const res = await pool.query<{ id: string }>(
    `
    INSERT INTO "Entity" (
      "id", "systemId", "documentId", "groupId", "type", "name", "slug",
      "sourcePageStart", "sourcePageEnd", "sourceChunkStart", "sourceChunkEnd",
      "confidence", "extractionMethod", "coreData", "rawData", "createdAt", "updatedAt"
    )
    VALUES (
      $1, $2, $3, $4, $5, $6, $7,
      $8, $9, $10, $11,
      $12, $13, $14::jsonb, $15::jsonb, NOW(), NOW()
    )
    ON CONFLICT ("systemId", "type", "slug", "sourceChunkStart", "sourceChunkEnd")
    DO UPDATE SET
      "name" = EXCLUDED."name",
      "confidence" = EXCLUDED."confidence",
      "extractionMethod" = EXCLUDED."extractionMethod",
      "coreData" = EXCLUDED."coreData",
      "rawData" = EXCLUDED."rawData",
      "groupId" = EXCLUDED."groupId",
      "updatedAt" = NOW()
    RETURNING "id"
    `,
    [
      randomUUID(),
      params.systemId,
      params.documentId,
      params.groupId,
      params.type,
      params.name,
      params.slug,
      params.sourcePageStart,
      params.sourcePageEnd,
      params.sourceChunkStart,
      params.sourceChunkEnd,
      params.confidence,
      params.extractionMethod,
      JSON.stringify(params.coreData ?? {}),
      params.rawData ? JSON.stringify(params.rawData) : null,
    ],
  );

  return res.rows[0]?.id ?? null;
}

export async function insertRuleLinks(params: {
  entityId: string;
  links: Array<{ chunkId: string; relation: string; confidence: number; rationale?: string }>;
}) {
  if (params.links.length === 0) {
    return 0;
  }

  const values: Array<string> = [];
  const payload: Array<unknown> = [];
  let idx = 1;

  for (const link of params.links) {
    values.push(`($${idx++}, $${idx++}, $${idx++}, $${idx++}, $${idx++}, $${idx++}, NOW())`);
    payload.push(
      randomUUID(),
      params.entityId,
      link.chunkId,
      link.relation,
      link.confidence,
      link.rationale ?? null,
    );
  }

  const res = await pool.query(
    `
    INSERT INTO "EntityRuleLink" ("id", "entityId", "chunkId", "relation", "confidence", "rationale", "createdAt")
    VALUES ${values.join(", ")}
    ON CONFLICT ("entityId", "chunkId", "relation") DO NOTHING
    `,
    payload,
  );

  return res.rowCount ?? 0;
}
