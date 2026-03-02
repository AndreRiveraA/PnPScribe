import fs from "node:fs/promises";
import path from "node:path";

import { chunkText } from "./chunking.js";
import { config } from "./config.js";
import {
  getDocument,
  replaceDocumentChunks,
  saveOcrTextAndDiagnostics,
  setDocumentOcrFailed,
  setDocumentOcrProcessing,
  updateDocumentOcrProgress,
} from "./db.js";
import { embedDocumentChunks } from "./embeddings.js";
import { ocrTranscribePdf } from "./pdf-ocr.js";
import type { OcrDocumentJobPayload } from "./types.js";

function mergeSupplementText(existing: string | null, ocrText: string) {
  const base = (existing ?? "").trim();
  const ocr = ocrText.trim();

  if (!base) {
    return ocr;
  }

  if (!ocr) {
    return base;
  }

  if (base === ocr) {
    return base;
  }

  if (ocr.length > base.length * 1.2) {
    return ocr;
  }

  return `${base}\n\n[OCR_SUPPLEMENT]\n${ocr}`;
}

export async function processOcrJob(
  payload: OcrDocumentJobPayload,
  hooks?: {
    onProgress?: (progress: {
      currentPage: number;
      totalPages: number;
      message: string;
    }) => Promise<void> | void;
  },
) {
  const startedAt = Date.now();
  console.log("[ocr-worker] processor: lookup document", {
    documentId: payload.documentId,
  });

  const document = await getDocument(payload.documentId);
  if (!document) {
    throw new Error(`Document not found: ${payload.documentId}`);
  }

  const absolutePath = path.resolve(config.projectRoot, document.filePath);
  console.log("[ocr-worker] processor: document found", {
    documentId: document.id,
    systemId: document.systemId,
    filePath: document.filePath,
    absolutePath,
    ocrStatus: document.ocrStatus,
    ocrMode: document.ocrMode,
    ocrReason: document.ocrReason,
  });

  await setDocumentOcrProcessing(document.id);
  console.log("[ocr-worker] processor: marked processing", { documentId: document.id });

  try {
    const readStartedAt = Date.now();
    const fileBuffer = await fs.readFile(absolutePath);
    console.log("[ocr-worker] processor: file loaded", {
      documentId: document.id,
      bytes: fileBuffer.byteLength,
      durationMs: Date.now() - readStartedAt,
    });

    const ocrStartedAt = Date.now();
    const ocr = await ocrTranscribePdf(fileBuffer, {
      fullRun: payload.fullRun,
      onProgress: async (progress) => {
        await updateDocumentOcrProgress({
          documentId: document.id,
          currentPage: progress.currentPage,
          totalPages: progress.totalPages,
          message: progress.message,
        });
        await hooks?.onProgress?.(progress);
      },
    });
    console.log("[ocr-worker] processor: OCR transcription complete", {
      documentId: document.id,
      pageCount: ocr.pageCount,
      pageCapApplied: ocr.pageCapApplied,
      mode: payload.mode,
      fullRun: payload.fullRun,
      durationMs: Date.now() - ocrStartedAt,
      extractedDurationMs: ocr.durationMs,
    });

    const ocrText = ocr.text.trim();

    if (!ocrText) {
      throw new Error("OCR returned no text.");
    }

    const text = payload.mode === "supplement"
      ? mergeSupplementText(document.extractedText, ocrText)
      : ocrText;

    console.log("[ocr-worker] processor: OCR text stats", {
      documentId: document.id,
      ocrTextLength: ocrText.length,
      textLength: text.length,
      charsPerPage:
        ocr.pageCount && ocr.pageCount > 0 ? Math.round(text.length / ocr.pageCount) : null,
    });

    const saveStartedAt = Date.now();
    await saveOcrTextAndDiagnostics({
      documentId: document.id,
      text,
      pageCount: ocr.pageCount,
      durationMs: ocr.durationMs,
    });
    await updateDocumentOcrProgress({
      documentId: document.id,
      currentPage: ocr.pageCount ?? 0,
      totalPages: ocr.pageCount ?? 0,
      message:
        ocr.pageCapApplied
          ? `OCR completed (dev cap ${ocr.pageCapApplied} pages, mode=${payload.mode})`
          : `OCR completed (mode=${payload.mode})`,
    });
    console.log("[ocr-worker] processor: saved OCR text+diagnostics", {
      documentId: document.id,
      durationMs: Date.now() - saveStartedAt,
    });

    const chunkStartedAt = Date.now();
    const chunks = chunkText(text).map((chunk: { content: string; index: number; pageNumber: number | null; chapterHint: string | null }) => ({
      content: chunk.content,
      chunkIndex: chunk.index,
      pageNumber: chunk.pageNumber,
      chapterHint: chunk.chapterHint,
    }));
    console.log("[ocr-worker] processor: chunked text", {
      documentId: document.id,
      chunkCount: chunks.length,
      durationMs: Date.now() - chunkStartedAt,
    });

    const replaceChunksStartedAt = Date.now();
    await replaceDocumentChunks(document.id, chunks);
    console.log("[ocr-worker] processor: replaced chunks", {
      documentId: document.id,
      chunkCount: chunks.length,
      durationMs: Date.now() - replaceChunksStartedAt,
    });

    const embedStartedAt = Date.now();
    const embedResult = await embedDocumentChunks(document.id);
    console.log("[ocr-worker] processor: embeddings complete", {
      documentId: document.id,
      embeddedCount: embedResult.embeddedCount,
      durationMs: Date.now() - embedStartedAt,
    });

    return {
      documentId: document.id,
      pageCount: ocr.pageCount,
      textLength: text.length,
      chunkCount: chunks.length,
      embeddedCount: embedResult.embeddedCount,
      totalDurationMs: Date.now() - startedAt,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "OCR worker failed.";
    console.error("[ocr-worker] processor: failed", {
      documentId: document.id,
      message,
      totalDurationMs: Date.now() - startedAt,
    });
    await setDocumentOcrFailed(document.id, message);
    throw error;
  }
}
