import "server-only";

import fs from "node:fs/promises";
import { createRequire } from "node:module";

import type { PDFDocumentProxy } from "pdfjs-dist";

import { prisma } from "@/lib/prisma";

const require = createRequire(import.meta.url);

const pdfjs = require("pdfjs-dist/legacy/build/pdf.mjs") as {
  getDocument: (params: { data: Uint8Array }) => { promise: Promise<PDFDocumentProxy> };
  GlobalWorkerOptions: { workerSrc?: string };
};

async function extractOutlineFromPdf(absolutePdfPath: string) {
  if (!(pdfjs.GlobalWorkerOptions.workerSrc ?? "")) {
    pdfjs.GlobalWorkerOptions.workerSrc = require.resolve(
      "pdfjs-dist/legacy/build/pdf.worker.mjs",
    );
  }

  const buffer = await fs.readFile(absolutePdfPath);
  const loadingTask = pdfjs.getDocument({ data: new Uint8Array(buffer) });
  const pdf = await loadingTask.promise;

  try {
    const outline = await pdf.getOutline();
    if (!outline || !Array.isArray(outline)) {
      return [] as Array<{
        title: string;
        pageNumber: number | null;
        level: number;
      }>;
    }

    const results: Array<{ title: string; pageNumber: number | null; level: number }> = [];

    async function walk(nodes: any[], level: number) {
      for (const node of nodes) {
        const title = typeof node.title === "string" ? node.title.trim() : "";
        let pageNumber: number | null = null;

        if (node.dest) {
          const dest = await pdf.getDestination(node.dest).catch(() => null);
          if (dest) {
            const [ref] = dest;
            const pageIndex = await pdf.getPageIndex(ref).catch(() => null);
            if (typeof pageIndex === "number") {
              pageNumber = pageIndex + 1;
            }
          }
        }

        if (title) {
          results.push({ title, pageNumber, level });
        }

        if (Array.isArray(node.items) && node.items.length > 0) {
          await walk(node.items, level + 1);
        }
      }
    }

    await walk(outline, 0);
    return results;
  } finally {
    await pdf.destroy();
  }
}

export async function refreshDocumentChapters(params: {
  documentId: string;
  absolutePdfPath: string;
}) {
  const outline = await extractOutlineFromPdf(params.absolutePdfPath);
  if (outline.length === 0) {
    return { chapterCount: 0 };
  }

  await prisma.documentChapter.deleteMany({
    where: { documentId: params.documentId },
  });

  const chapters = outline.map((entry, idx) => {
    const next = outline[idx + 1];
    const pageStart = entry.pageNumber ?? null;
    const pageEnd = next?.pageNumber ? Math.max(next.pageNumber - 1, pageStart ?? 1) : null;
    return {
      documentId: params.documentId,
      title: entry.title.slice(0, 200),
      pageStart,
      pageEnd,
      level: entry.level,
    };
  });

  await prisma.documentChapter.createMany({ data: chapters });

  return { chapterCount: chapters.length };
}
