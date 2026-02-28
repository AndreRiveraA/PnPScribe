import OpenAI from "openai";

import { config } from "./config.js";
import {
  clearEntitiesForDocument,
  listCandidateGroups,
  listChunksForGroup,
  listNearbyChunks,
  setEntityCompleted,
  setEntityFailed,
  setEntityProcessing,
  setEntityProgress,
  upsertEntity,
  insertRuleLinks,
} from "./db.js";
import type { ChunkGroupRecord } from "./db.js";
import type { EntityExtractionJobPayload } from "./types.js";

const openai = new OpenAI({ apiKey: config.openAiApiKey });

type CandidateType = "monster" | "item";

interface NormalizedEntity {
  type: CandidateType;
  name: string;
  aliases: string[];
  confidence: number;
  coreData: Record<string, unknown>;
  rawData: Record<string, unknown> | null;
}

function slugify(input: string) {
  return input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 120);
}

function parseJsonObject(input: string) {
  try {
    const parsed = JSON.parse(input);
    return typeof parsed === "object" && parsed !== null ? parsed : null;
  } catch {
    return null;
  }
}

function inferNameFromTitle(group: ChunkGroupRecord, content: string) {
  const title = group.title?.trim();
  if (title && title.length > 2) {
    return title.replace(/^(chapter|section|part)\s*[:0-9.-]*\s*/i, "").slice(0, 120);
  }

  const firstLine = content
    .split("\n")
    .map((line) => line.trim())
    .find((line) => line.length > 2);

  return (firstLine ?? "Unknown Entity").slice(0, 120);
}

async function normalizeEntityWithLlm(group: ChunkGroupRecord, content: string): Promise<NormalizedEntity | null> {
  const guessedType: CandidateType = group.kind === "item_section" ? "item" : "monster";
  const fallbackName = inferNameFromTitle(group, content);

  try {
    const response = await openai.responses.create({
      model: config.entityModel,
      temperature: 0,
      max_output_tokens: 700,
      input: [
        {
          role: "system",
          content:
            "Extract one RPG entity from text. Return strict JSON only. No markdown. Schema: {entityType:'monster'|'item',name:string,aliases:string[],confidence:number,coreData:object,notes:string[]}",
        },
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text: `Section kind: ${group.kind}\nTitle: ${group.title ?? ""}\nText:\n${content.slice(0, 9000)}`,
            },
          ],
        },
      ],
    });

    const raw = parseJsonObject(response.output_text ?? "");
    if (!raw) {
      return {
        type: guessedType,
        name: fallbackName,
        aliases: [],
        confidence: 0.55,
        coreData: {
          extractedBy: "fallback",
          sourceKind: group.kind,
        },
        rawData: {
          llmParse: "invalid_json",
          output: response.output_text ?? "",
        },
      };
    }

    const parsed = raw as {
      entityType?: unknown;
      name?: unknown;
      aliases?: unknown;
      confidence?: unknown;
      coreData?: unknown;
    };

    const entityType = parsed.entityType === "item" ? "item" : "monster";
    const name =
      typeof parsed.name === "string" && parsed.name.trim().length > 0
        ? parsed.name.trim().slice(0, 140)
        : fallbackName;
    const aliases = Array.isArray(parsed.aliases)
      ? parsed.aliases.filter((alias): alias is string => typeof alias === "string").slice(0, 20)
      : [];
    const confidence =
      typeof parsed.confidence === "number" && Number.isFinite(parsed.confidence)
        ? Math.max(0, Math.min(1, parsed.confidence))
        : 0.6;
    const coreData =
      typeof parsed.coreData === "object" && parsed.coreData !== null
        ? (parsed.coreData as Record<string, unknown>)
        : {};

    return {
      type: entityType,
      name,
      aliases,
      confidence,
      coreData,
      rawData: {
        llm: parsed,
      },
    };
  } catch (error) {
    return {
      type: guessedType,
      name: fallbackName,
      aliases: [],
      confidence: 0.5,
      coreData: {
        extractedBy: "heuristic",
        sourceKind: group.kind,
      },
      rawData: {
        llmError: error instanceof Error ? error.message : "unknown",
      },
    };
  }
}

function inferRuleRelation(content: string): "create" | "modify" | "usage" {
  if (/(create|build|new|construct|generate)/i.test(content)) {
    return "create";
  }

  if (/(modify|adjust|customi[sz]e|variant|template)/i.test(content)) {
    return "modify";
  }

  return "usage";
}

export async function processEntityJob(
  payload: EntityExtractionJobPayload,
  params?: { onProgress?: (message: string, extractedCount: number, ruleLinkCount: number) => Promise<void> },
) {
  await setEntityProcessing(payload.documentId);
  await clearEntitiesForDocument(payload.documentId);

  const groups = await listCandidateGroups(payload.documentId);
  let extractedEntities = 0;
  let linkedRules = 0;
  const linkedImages = 0;

  for (let index = 0; index < groups.length; index += 1) {
    const group = groups[index]!;
    const chunks = await listChunksForGroup(group.id);
    if (chunks.length === 0) {
      continue;
    }

    const content = chunks.map((chunk) => chunk.content).join("\n\n");
    const normalized = await normalizeEntityWithLlm(group, content);
    if (!normalized || normalized.confidence < config.confidenceThreshold) {
      continue;
    }

    const slug = slugify(normalized.name);
    if (!slug) {
      continue;
    }

    const entityId = await upsertEntity({
      systemId: payload.systemId,
      documentId: payload.documentId,
      groupId: group.id,
      type: normalized.type,
      name: normalized.name,
      slug,
      sourcePageStart: group.startPage,
      sourcePageEnd: group.endPage,
      sourceChunkStart: group.startChunkIndex,
      sourceChunkEnd: group.endChunkIndex,
      confidence: normalized.confidence,
      extractionMethod: "hybrid",
      coreData: {
        ...normalized.coreData,
        aliases: normalized.aliases,
      },
      rawData: normalized.rawData,
    });

    if (!entityId) {
      continue;
    }

    extractedEntities += 1;

    const nearby = await listNearbyChunks(
      payload.documentId,
      Math.max(0, group.startChunkIndex - config.ruleLinkWindow),
      group.endChunkIndex + config.ruleLinkWindow,
    );

    const linkCandidates = nearby
      .map((chunk) => ({
        id: chunk.id,
        relation: inferRuleRelation(chunk.content),
        score: /(create|modify|variant|template|customi[sz]e|build)/i.test(chunk.content) ? 0.8 : 0.45,
      }))
      .filter((candidate) => candidate.score >= 0.55)
      .slice(0, 8)
      .map((candidate) => ({
        chunkId: candidate.id,
        relation: candidate.relation,
        confidence: candidate.score,
        rationale: "Nearby rule chunk classified by keyword matcher.",
      }));

    const inserted = await insertRuleLinks({
      entityId,
      links: linkCandidates,
    });

    linkedRules += inserted;

    if (params?.onProgress) {
      await params.onProgress(
        `Processed ${index + 1}/${groups.length} entity groups`,
        extractedEntities,
        linkedRules,
      );
    }

    await setEntityProgress(payload.documentId, {
      message: `Processed ${index + 1}/${groups.length} entity groups`,
      extractedCount: extractedEntities,
      ruleLinkCount: linkedRules,
      imageCount: linkedImages,
    });
  }

  await setEntityCompleted(payload.documentId, {
    extractedCount: extractedEntities,
    ruleLinkCount: linkedRules,
    imageCount: linkedImages,
  });

  return {
    extractedEntities,
    linkedRules,
    linkedImages,
  };
}

export async function processEntityJobSafely(payload: EntityExtractionJobPayload) {
  try {
    return await processEntityJob(payload);
  } catch (error) {
    await setEntityFailed(
      payload.documentId,
      error instanceof Error ? error.message : "Entity extraction failed.",
    );
    throw error;
  }
}
