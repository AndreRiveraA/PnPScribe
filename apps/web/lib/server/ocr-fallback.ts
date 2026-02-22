import "server-only";

import { prisma } from "@/lib/prisma";

export interface OcrAssessmentInput {
  extractionStatus: "succeeded" | "failed";
  text: string;
  pageCount: number | null;
}

export interface OcrAssessment {
  needed: boolean;
  reason: string | null;
}

const MIN_TOTAL_TEXT_CHARS = 500;
const MIN_CHARS_PER_PAGE = 120;

export function assessOcrFallbackNeed(input: OcrAssessmentInput): OcrAssessment {
  if (input.extractionStatus === "failed") {
    return {
      needed: true,
      reason: "digital_extraction_failed",
    };
  }

  const textLength = input.text.trim().length;
  if (textLength === 0) {
    return {
      needed: true,
      reason: "digital_text_empty",
    };
  }

  if (textLength < MIN_TOTAL_TEXT_CHARS) {
    return {
      needed: true,
      reason: "digital_text_too_short",
    };
  }

  if (input.pageCount !== null && input.pageCount > 0) {
    const charsPerPage = textLength / input.pageCount;
    if (charsPerPage < MIN_CHARS_PER_PAGE) {
      return {
        needed: true,
        reason: "digital_text_density_low",
      };
    }
  }

  return {
    needed: false,
    reason: null,
  };
}

export async function markDocumentOcrNeeded(documentId: string, reason: string) {
  return prisma.document.update({
    where: { id: documentId },
    data: {
      ocrStatus: "needed",
      ocrReason: reason.slice(0, 120),
      ocrError: null,
      ocrRequestedAt: null,
      ocrCompletedAt: null,
    },
    select: {
      ocrStatus: true,
      ocrReason: true,
      ocrError: true,
      ocrRequestedAt: true,
      ocrCompletedAt: true,
    },
  });
}

export async function clearDocumentOcrNeed(documentId: string) {
  return prisma.document.update({
    where: { id: documentId },
    data: {
      ocrStatus: "not_requested",
      ocrReason: null,
      ocrError: null,
      ocrRequestedAt: null,
      ocrCompletedAt: null,
    },
    select: {
      ocrStatus: true,
      ocrReason: true,
      ocrError: true,
      ocrRequestedAt: true,
      ocrCompletedAt: true,
    },
  });
}

export async function enqueueOcrFallbackStub(documentId: string) {
  const updated = await prisma.document.update({
    where: { id: documentId },
    data: {
      ocrStatus: "queued",
      ocrRequestedAt: new Date(),
      ocrError: null,
    },
    select: {
      id: true,
      ocrStatus: true,
      ocrReason: true,
      ocrRequestedAt: true,
    },
  });

  return {
    queued: false,
    provider: "stub",
    message: "OCR worker queue is not implemented yet.",
    document: updated,
  };
}
