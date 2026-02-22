import "server-only";

import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { prisma } from "@/lib/prisma";
import { replaceChunksForDocument } from "@/lib/server/chunks";
import { embedMissingChunksForDocument } from "@/lib/server/embeddings";
import { HttpError } from "@/lib/server/http-error";
import {
  assessOcrFallbackNeed,
  clearDocumentOcrNeed,
  markDocumentOcrNeeded,
} from "@/lib/server/ocr-fallback";
import { extractPdfText } from "@/lib/server/pdf-text";

function sanitizeFilename(name: string) {
  const normalized = name.trim().replace(/\s+/g, "-").toLowerCase();
  const safe = normalized.replace(/[^a-z0-9._-]/g, "");
  return safe || "upload.pdf";
}

function isPdf(file: File) {
  return (
    file.type === "application/pdf" ||
    file.name.toLowerCase().endsWith(".pdf")
  );
}

function getSystemId(formData: FormData) {
  const systemIdValue = formData.get("systemId");
  const systemId = typeof systemIdValue === "string" ? systemIdValue.trim() : "";

  if (!systemId) {
    throw new HttpError(400, "systemId is required.");
  }

  return systemId;
}

function getUploadFile(formData: FormData) {
  const fileValue = formData.get("file");

  if (!(fileValue instanceof File)) {
    throw new HttpError(400, "file is required.");
  }

  if (!isPdf(fileValue)) {
    throw new HttpError(400, "Only PDF uploads are supported.");
  }

  return fileValue;
}

export async function uploadDocumentFromFormData(formData: FormData) {
  const systemId = getSystemId(formData);
  const file = getUploadFile(formData);

  const system = await prisma.system.findUnique({
    where: { id: systemId },
    select: { id: true },
  });

  if (!system) {
    throw new HttpError(404, "System not found.");
  }

  const uploadsRoot = path.resolve(process.cwd(), "..", "..", "uploads");
  const systemDir = path.join(uploadsRoot, system.id);
  await mkdir(systemDir, { recursive: true });

  const safeName = sanitizeFilename(file.name);
  const storedName = `${Date.now()}-${randomUUID()}-${safeName}`;
  const absolutePath = path.join(systemDir, storedName);
  const relativePath = path.posix.join("uploads", system.id, storedName);

  const buffer = Buffer.from(await file.arrayBuffer());
  await writeFile(absolutePath, buffer);

  const document = await prisma.document.create({
    data: {
      systemId: system.id,
      filePath: relativePath,
      extractionStatus: "pending",
    },
    select: {
      id: true,
      filePath: true,
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
      systemId: true,
      createdAt: true,
    },
  });

  let extractionStatus = document.extractionStatus;
  let extractionError = document.extractionError;
  let extractedAt = document.extractedAt;
  let extractedTextLength = document.extractedTextLength;
  let extractedPageCount = document.extractedPageCount;
  let extractionDurationMs = document.extractionDurationMs;
  let ocrStatus = document.ocrStatus;
  let ocrReason = document.ocrReason;
  let ocrError = document.ocrError;
  let ocrRequestedAt = document.ocrRequestedAt;
  let ocrCompletedAt = document.ocrCompletedAt;
  let chunkCount = 0;
  let embeddedCount = 0;
  let embeddingError: string | null = null;

  try {
    const extraction = await extractPdfText(absolutePath);
    const extractedText = extraction.text;

    if (!extractedText) {
      throw new Error("No extractable digital text found in PDF.");
    }

    const updated = await prisma.document.update({
      where: { id: document.id },
      data: {
        extractedText,
        extractedTextLength: extractedText.length,
        extractedPageCount: extraction.pageCount,
        extractionDurationMs: extraction.durationMs,
        extractionStatus: "succeeded",
        extractionError: null,
        extractedAt: new Date(),
      },
      select: {
        extractedTextLength: true,
        extractedPageCount: true,
        extractionDurationMs: true,
        extractionStatus: true,
        extractionError: true,
        extractedAt: true,
      },
    });

    extractionStatus = updated.extractionStatus;
    extractionError = updated.extractionError;
    extractedAt = updated.extractedAt;
    extractedTextLength = updated.extractedTextLength;
    extractedPageCount = updated.extractedPageCount;
    extractionDurationMs = updated.extractionDurationMs;

    const ocrAssessment = assessOcrFallbackNeed({
      extractionStatus: "succeeded",
      text: extractedText,
      pageCount: extraction.pageCount,
    });

    const ocrUpdated = ocrAssessment.needed
      ? await markDocumentOcrNeeded(document.id, ocrAssessment.reason ?? "ocr_recommended")
      : await clearDocumentOcrNeed(document.id);

    ocrStatus = ocrUpdated.ocrStatus;
    ocrReason = ocrUpdated.ocrReason;
    ocrError = ocrUpdated.ocrError;
    ocrRequestedAt = ocrUpdated.ocrRequestedAt;
    ocrCompletedAt = ocrUpdated.ocrCompletedAt;

    const chunkResult = await replaceChunksForDocument(document.id, extractedText);
    chunkCount = chunkResult.chunkCount;

    if (chunkCount > 0) {
      try {
        const embeddingResult = await embedMissingChunksForDocument(document.id);
        embeddedCount = embeddingResult.embeddedCount;
      } catch (error) {
        embeddingError =
          error instanceof Error ? error.message.slice(0, 500) : "Embedding failed.";
      }
    }
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "PDF text extraction failed.";

    const updated = await prisma.document.update({
      where: { id: document.id },
      data: {
        extractionStatus: "failed",
        extractionError: message.slice(0, 500),
        extractionDurationMs: null,
        ocrStatus: "needed",
        ocrReason: "digital_extraction_failed",
        ocrError: null,
        ocrRequestedAt: null,
        ocrCompletedAt: null,
        extractedAt: null,
      },
      select: {
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
      },
    });

    extractionStatus = updated.extractionStatus;
    extractionError = updated.extractionError;
    extractedAt = updated.extractedAt;
    extractedTextLength = updated.extractedTextLength;
    extractedPageCount = updated.extractedPageCount;
    extractionDurationMs = updated.extractionDurationMs;
    ocrStatus = updated.ocrStatus;
    ocrReason = updated.ocrReason;
    ocrError = updated.ocrError;
    ocrRequestedAt = updated.ocrRequestedAt;
    ocrCompletedAt = updated.ocrCompletedAt;
  }

  return {
    document: {
      ...document,
      extractedTextLength,
      extractedPageCount,
      extractionDurationMs,
      ocrStatus,
      ocrReason,
      ocrError,
      ocrRequestedAt,
      ocrCompletedAt,
      extractionStatus,
      extractionError,
      extractedAt,
    },
    processing: {
      chunkCount,
      embeddedCount,
      embeddingError,
    },
    file: {
      originalName: file.name,
      mimeType: file.type || "application/pdf",
      size: file.size,
    },
  };
}
