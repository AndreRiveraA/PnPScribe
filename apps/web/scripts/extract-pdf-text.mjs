import fs from "node:fs/promises";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

async function main() {
  const filePath = process.argv[2];

  if (!filePath) {
    throw new Error("Usage: node extract-pdf-text.mjs <pdf-path>");
  }

  const { PDFParse } = require("pdf-parse");
  if (typeof PDFParse !== "function") {
    throw new Error("Unsupported pdf-parse module shape (expected PDFParse export).");
  }

  const workerPath = require.resolve("pdfjs-dist/legacy/build/pdf.worker.mjs");
  if (typeof PDFParse.setWorker === "function") {
    PDFParse.setWorker(workerPath);
  }

  const data = await fs.readFile(filePath);
  const parser = new PDFParse({ data });

  try {
    const result = await parser.getText();
    const text = typeof result?.text === "string" ? result.text : "";
    const pageCount =
      typeof result?.total === "number"
        ? result.total
        : Array.isArray(result?.pages)
          ? result.pages.length
          : null;
    process.stdout.write(JSON.stringify({ text, pageCount }));
  } finally {
    if (typeof parser.destroy === "function") {
      await parser.destroy().catch(() => undefined);
    }
  }
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(message);
  process.exit(1);
});
