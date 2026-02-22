import "server-only";

export interface TextChunk {
  content: string;
  index: number;
  pageNumber: number | null;
  chapterHint: string | null;
}

const DEFAULT_CHUNK_SIZE = 1200;
const DEFAULT_CHUNK_OVERLAP = 200;
const DEFAULT_MIN_CHUNK_SIZE = 300;

export function chunkText(
  text: string,
  options?: { chunkSize?: number; overlap?: number; minChunkSize?: number },
): TextChunk[] {
  const chunkSize = options?.chunkSize ?? DEFAULT_CHUNK_SIZE;
  const overlap = options?.overlap ?? DEFAULT_CHUNK_OVERLAP;
  const minChunkSize = Math.min(
    Math.max(options?.minChunkSize ?? DEFAULT_MIN_CHUNK_SIZE, 1),
    chunkSize,
  );

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
      const end = chooseChunkEnd(pageText, start, roughEnd, chunkSize, minChunkSize);

      const content = pageText.slice(start, end).trim();
      if (content) {
        const chunk: TextChunk = {
          content,
          index,
          pageNumber: pages.length > 1 ? pageIndex + 1 : null,
          chapterHint: findChapterHint(content),
        };

        const previous = chunks[chunks.length - 1];
        const shouldMergeTinyTail =
          previous !== undefined &&
          previous.pageNumber === chunk.pageNumber &&
          content.length < minChunkSize &&
          previous.content.length + 2 + content.length <= chunkSize + Math.floor(overlap / 2);

        if (shouldMergeTinyTail) {
          previous.content = `${previous.content}\n\n${content}`;
          if (!previous.chapterHint && chunk.chapterHint) {
            previous.chapterHint = chunk.chapterHint;
          }
        } else {
          chunks.push(chunk);
          index += 1;
        }
      }

      if (end >= pageText.length) {
        break;
      }

      const nextStartCandidate = Math.max(start + 1, end - overlap);
      start = nextStartCandidate <= start ? start + step : nextStartCandidate;
    }
  }

  return chunks;
}

function chooseChunkEnd(
  text: string,
  start: number,
  roughEnd: number,
  chunkSize: number,
  minChunkSize: number,
) {
  if (roughEnd >= text.length) {
    return text.length;
  }

  const window = text.slice(start, roughEnd);
  const minBreakOffset = Math.min(window.length - 1, Math.floor(chunkSize * 0.55));

  const preferredOffsets = [
    window.lastIndexOf("\n\n"),
    window.lastIndexOf("\n"),
    window.lastIndexOf(". "),
    window.lastIndexOf("! "),
    window.lastIndexOf("? "),
    window.lastIndexOf("; "),
    window.lastIndexOf(": "),
    window.lastIndexOf(", "),
    window.lastIndexOf(" "),
  ];

  for (const offset of preferredOffsets) {
    if (offset >= minBreakOffset) {
      const end = start + offset + 1;
      if (end - start >= Math.min(minChunkSize, window.length)) {
        return end;
      }
    }
  }

  return roughEnd;
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
