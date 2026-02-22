import "server-only";

export interface TextChunk {
  content: string;
  index: number;
  pageNumber: number | null;
  chapterHint: string | null;
}

const DEFAULT_CHUNK_SIZE = 1200;
const DEFAULT_CHUNK_OVERLAP = 200;

export function chunkText(
  text: string,
  options?: { chunkSize?: number; overlap?: number },
): TextChunk[] {
  const chunkSize = options?.chunkSize ?? DEFAULT_CHUNK_SIZE;
  const overlap = options?.overlap ?? DEFAULT_CHUNK_OVERLAP;

  if (chunkSize <= 0) {
    return [];
  }

  const normalized = text.replace(/\r\n/g, "\n").replace(/\t/g, " ").trim();
  if (!normalized) {
    return [];
  }

  const chunks: TextChunk[] = [];
  const pages = normalized.split("\f");
  let index = 0;
  const step = Math.max(1, chunkSize - Math.max(0, overlap));

  for (let pageIndex = 0; pageIndex < pages.length; pageIndex += 1) {
    const pageText = pages[pageIndex]?.trim();
    if (!pageText) {
      continue;
    }

    let start = 0;

    while (start < pageText.length) {
      const roughEnd = Math.min(pageText.length, start + chunkSize);
      let end = roughEnd;

      if (roughEnd < pageText.length) {
        const window = pageText.slice(start, roughEnd);
        const splitAt =
          Math.max(window.lastIndexOf("\n\n"), window.lastIndexOf(". ")) + 1;

        if (splitAt > Math.floor(chunkSize * 0.6)) {
          end = start + splitAt;
        }
      }

      const content = pageText.slice(start, end).trim();
      if (content) {
        chunks.push({
          content,
          index,
          pageNumber: pages.length > 1 ? pageIndex + 1 : null,
          chapterHint: findChapterHint(content),
        });
        index += 1;
      }

      if (end >= pageText.length) {
        break;
      }

      start += step;
    }
  }

  return chunks;
}

function findChapterHint(content: string) {
  const lines = content
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 6);

  for (const line of lines) {
    if (/^(chapter|section|part)\b/i.test(line)) {
      return line.slice(0, 140);
    }

    if (/^[A-Z][A-Z0-9\s:,-]{4,80}$/.test(line)) {
      return line.slice(0, 140);
    }
  }

  return null;
}
