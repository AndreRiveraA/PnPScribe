import "server-only";

import { Prisma } from "@prisma/client";

import { pickChatModel } from "@/lib/ai/model";
import { MODELS, type ChatModelTier, openai } from "@/lib/openai";
import { prisma } from "@/lib/prisma";
import { HttpError } from "@/lib/server/http-error";

interface RetrievedChunk {
  id: string;
  content: string;
  chunkIndex: number;
  pageNumber: number | null;
  chapterHint: string | null;
  documentId: string;
  filePath: string;
  distance: number;
}

function toVectorLiteral(values: number[]) {
  return `[${values.join(",")}]`;
}

export function parseRulesQuestion(input: unknown) {
  const question = typeof input === "string" ? input.trim() : "";

  if (!question) {
    throw new HttpError(400, "question is required.");
  }

  if (question.length > 2000) {
    throw new HttpError(400, "question is too long (max 2000 chars).");
  }

  return question;
}

export async function retrieveRuleChunks(params: {
  systemId: string;
  question: string;
  topK?: number;
}) {
  const embeddingResponse = await openai.embeddings.create({
    model: MODELS.embed,
    input: params.question,
  });

  const questionEmbedding = embeddingResponse.data[0]?.embedding;
  if (!Array.isArray(questionEmbedding) || questionEmbedding.length === 0) {
    throw new Error("Failed to generate question embedding.");
  }

  const vectorLiteral = toVectorLiteral(questionEmbedding);
  const topK = Math.min(Math.max(params.topK ?? 5, 1), 8);

  const rows = await prisma.$queryRaw<
    Array<{
      id: string;
      content: string;
      chunkIndex: number;
      pageNumber: number | null;
      chapterHint: string | null;
      documentId: string;
      filePath: string;
      distance: number;
    }>
  >(Prisma.sql`
    SELECT
      c."id",
      c."content",
      c."chunkIndex",
      c."pageNumber",
      c."chapterHint",
      c."documentId",
      d."filePath",
      (c."embedding" <=> CAST(${vectorLiteral} AS vector))::float8 AS "distance"
    FROM "Chunk" c
    INNER JOIN "Document" d ON d."id" = c."documentId"
    WHERE d."systemId" = ${params.systemId}
      AND c."embedding" IS NOT NULL
    ORDER BY c."embedding" <=> CAST(${vectorLiteral} AS vector)
    LIMIT ${topK}
  `);

  return rows as RetrievedChunk[];
}

function buildRulesPrompt(question: string, chunks: RetrievedChunk[]) {
  const contextText = chunks
    .map((chunk, index) => {
      const cleaned = chunk.content.replace(/\s+/g, " ").trim();
      const meta = [
        `chunkId=${chunk.id}`,
        `file=${chunk.filePath}`,
        `chunkIndex=${chunk.chunkIndex}`,
        chunk.pageNumber !== null ? `page=${chunk.pageNumber}` : null,
        chunk.chapterHint ? `chapter=${chunk.chapterHint}` : null,
      ]
        .filter(Boolean)
        .join(" ");

      return `[${index + 1}] ${meta}\n${cleaned}`;
    })
    .join("\n\n");

  return [
    "You are PnPScribe in strict Rules Mode.",
    "Answer only using the provided context chunks.",
    "If the answer is not in the context, reply exactly:",
    "This information was not found in the uploaded rulebook.",
    "Do not guess. Do not use outside knowledge.",
    "Cite chunk references like [1], [2].",
    "",
    "Question:",
    question,
    "",
    "Context:",
    contextText || "(none)",
  ].join("\n");
}

export async function answerRulesQuestion(params: {
  systemId: string;
  question: string;
  tier?: ChatModelTier;
}) {
  const system = await prisma.system.findUnique({
    where: { id: params.systemId },
    select: { id: true, name: true },
  });

  if (!system) {
    throw new HttpError(404, "System not found.");
  }

  const chunks = await retrieveRuleChunks({
    systemId: params.systemId,
    question: params.question,
    topK: 5,
  });

  if (chunks.length === 0) {
    return {
      system,
      answer: "This information was not found in the uploaded rulebook.",
      citations: [] as Array<{
        chunkId: string;
        filePath: string;
        chunkIndex: number;
        pageNumber: number | null;
        chapterHint: string | null;
        excerpt: string;
      }>,
      retrieval: { topK: 0 },
      model: pickChatModel(params.tier),
      tier: params.tier ?? "cheap",
    };
  }

  const model = pickChatModel(params.tier);
  const prompt = buildRulesPrompt(params.question, chunks);

  const response = await openai.responses.create({
    model,
    input: prompt,
    temperature: 0,
    max_output_tokens: 500,
  });

  return {
    system,
    answer:
      response.output_text?.trim() ||
      "This information was not found in the uploaded rulebook.",
    citations: chunks.map((chunk) => ({
      chunkId: chunk.id,
      filePath: chunk.filePath,
      chunkIndex: chunk.chunkIndex,
      pageNumber: chunk.pageNumber,
      chapterHint: chunk.chapterHint,
      excerpt: chunk.content.slice(0, 240),
    })),
    retrieval: { topK: chunks.length },
    model,
    tier: params.tier ?? "cheap",
  };
}
