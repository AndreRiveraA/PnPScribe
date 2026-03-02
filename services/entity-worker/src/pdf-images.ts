import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { createRequire } from "node:module";

import { createCanvas } from "@napi-rs/canvas";
import { getDocument, GlobalWorkerOptions } from "pdfjs-dist/legacy/build/pdf.mjs";
import { pathToFileURL } from "node:url";

const require = createRequire(import.meta.url);
GlobalWorkerOptions.workerSrc = require.resolve("pdfjs-dist/legacy/build/pdf.worker.mjs");
const standardFontDir = path.dirname(
  require.resolve("pdfjs-dist/standard_fonts/FoxitSerif.pfb"),
);
const standardFontDataUrl = pathToFileURL(standardFontDir + path.sep).toString();
const cMapDir = path.dirname(require.resolve("pdfjs-dist/cmaps/Identity-H"));
const cMapUrl = pathToFileURL(cMapDir + path.sep).toString();

class NodeCanvasFactory {
  create(width: number, height: number) {
    const canvas = createCanvas(width, height);
    const context = canvas.getContext("2d") as unknown as CanvasRenderingContext2D;
    return { canvas, context };
  }

  reset(
    canvasAndContext: { canvas: ReturnType<typeof createCanvas>; context: CanvasRenderingContext2D },
    width: number,
    height: number,
  ) {
    canvasAndContext.canvas.width = width;
    canvasAndContext.canvas.height = height;
  }

  destroy(canvasAndContext: { canvas: ReturnType<typeof createCanvas>; context: CanvasRenderingContext2D }) {
    canvasAndContext.canvas.width = 0;
    canvasAndContext.canvas.height = 0;
  }
}

function buildTargetPages(start: number, end: number, maxPages: number) {
  const safeStart = Math.max(1, start);
  const safeEnd = Math.max(safeStart, end);
  const pages: number[] = [];
  for (let page = safeStart; page <= safeEnd; page += 1) {
    pages.push(page);
    if (pages.length >= maxPages) {
      break;
    }
  }
  return pages;
}

export async function extractEntityImages(params: {
  systemId: string;
  documentId: string;
  entityId: string;
  absolutePdfPath: string;
  pageStart: number | null;
  pageEnd: number | null;
  maxPages: number;
  targetWidth: number;
}) {
  const pages = buildTargetPages(params.pageStart ?? 1, params.pageEnd ?? params.pageStart ?? 1, params.maxPages);
  if (pages.length === 0) {
    return [];
  }

  const pdfData = await import("node:fs/promises").then((mod) => mod.readFile(params.absolutePdfPath));
  const loadingTask = getDocument({
    data: new Uint8Array(pdfData),
    standardFontDataUrl,
    cMapUrl,
    cMapPacked: true,
    disableFontFace: true,
    useSystemFonts: true,
  });
  const pdf = await loadingTask.promise;

  const canvasFactory = new NodeCanvasFactory();
  const imageDir = path.resolve(
    process.cwd(),
    "..",
    "..",
    "uploads",
    params.systemId,
    "entities",
    params.documentId,
    params.entityId,
  );
  await mkdir(imageDir, { recursive: true });

  const created: Array<{ pageNumber: number; filePath: string; kind: string }> = [];

  try {
    for (const pageNumber of pages) {
      const page = await pdf.getPage(pageNumber);
      const initialViewport = page.getViewport({ scale: 1 });
      const scale = params.targetWidth > 0 ? params.targetWidth / initialViewport.width : 1;
      const viewport = page.getViewport({ scale });

      const { canvas, context } = canvasFactory.create(Math.ceil(viewport.width), Math.ceil(viewport.height));
      const renderTask = page.render({ canvasContext: context, viewport } as unknown as {
        canvasContext: CanvasRenderingContext2D;
        viewport: typeof viewport;
      });
      await renderTask.promise;

      const buffer = canvas.toBuffer("image/png");
      const fileName = `page-${pageNumber}.png`;
      const absolute = path.join(imageDir, fileName);
      const relative = path.posix.join(
        "uploads",
        params.systemId,
        "entities",
        params.documentId,
        params.entityId,
        fileName,
      );

      await writeFile(absolute, buffer);
      created.push({ pageNumber, filePath: relative, kind: "page_render" });
    }
  } finally {
    await pdf.destroy();
  }

  return created;
}
