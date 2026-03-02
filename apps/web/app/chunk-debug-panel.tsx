"use client";

import { useEffect, useMemo, useState } from "react";

type SystemOption = {
  id: string;
  name: string;
};

type SystemDocumentsResponse = {
  ok: boolean;
  error?: string;
  documents?: Array<{
    id: string;
    filePath: string;
    extractedTextLength: number | null;
    extractedPageCount: number | null;
    extractionDurationMs: number | null;
    ocrStatus: string;
    ocrMode: string | null;
    ocrReason: string | null;
    ocrError: string | null;
    ocrRequestedAt: string | null;
    ocrCompletedAt: string | null;
    ocrProgressCurrentPage: number | null;
    ocrProgressTotalPages: number | null;
    ocrProgressMessage: string | null;
    ocrProgressUpdatedAt: string | null;
    entityStatus: string;
    entityError: string | null;
    entityProgressMessage: string | null;
    entityProgressUpdatedAt: string | null;
    entityExtractedCount: number | null;
    entityRuleLinkCount: number | null;
    entityImageCount: number | null;
    extractionStatus: string;
    extractionError: string | null;
    extractedAt: string | null;
    createdAt: string;
    _count: {
      chunks: number;
    };
  }>;
};

type DocumentChunksResponse = {
  ok: boolean;
  error?: string;
  document?: {
    id: string;
    filePath: string;
    systemId: string;
    extractedTextLength: number | null;
    extractedPageCount: number | null;
    extractionDurationMs: number | null;
    ocrStatus: string;
    ocrMode: string | null;
    ocrReason: string | null;
    ocrError: string | null;
    ocrRequestedAt: string | null;
    ocrCompletedAt: string | null;
    ocrProgressCurrentPage: number | null;
    ocrProgressTotalPages: number | null;
    ocrProgressMessage: string | null;
    ocrProgressUpdatedAt: string | null;
    entityStatus: string;
    entityError: string | null;
    entityProgressMessage: string | null;
    entityProgressUpdatedAt: string | null;
    entityExtractedCount: number | null;
    entityRuleLinkCount: number | null;
    entityImageCount: number | null;
    extractionStatus: string;
    extractionError: string | null;
    extractedAt: string | null;
    createdAt: string;
    _count: {
      chunks: number;
    };
  };
  chunks?: Array<{
    id: string;
    chunkIndex: number;
    pageNumber: number | null;
    chapterHint: string | null;
    content: string;
    hasEmbedding: boolean;
    createdAt: string;
  }>;
};

export function ChunkDebugPanel({ systems }: { systems: SystemOption[] }) {
  const [systemId, setSystemId] = useState(systems[0]?.id ?? "");
  const [documentsState, setDocumentsState] = useState<{
    loading: boolean;
    error: string | null;
    documents: NonNullable<SystemDocumentsResponse["documents"]>;
  }>({ loading: false, error: null, documents: [] });
  const [documentId, setDocumentId] = useState("");
  const [chunksState, setChunksState] = useState<{
    loading: boolean;
    error: string | null;
    payload: DocumentChunksResponse | null;
  }>({ loading: false, error: null, payload: null });
  const [ocrRequestState, setOcrRequestState] = useState<{
    loading: boolean;
    error: string | null;
    message: string | null;
  }>({ loading: false, error: null, message: null });
  const [entityRequestState, setEntityRequestState] = useState<{
    loading: boolean;
    error: string | null;
    message: string | null;
  }>({ loading: false, error: null, message: null });
  const [resetState, setResetState] = useState<{
    loading: boolean;
    error: string | null;
    message: string | null;
  }>({ loading: false, error: null, message: null });
  const [ocrMode, setOcrMode] = useState<"replace" | "supplement">("replace");
  const [ocrFullRun, setOcrFullRun] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadDocuments() {
      if (!systemId) {
        setDocumentsState({ loading: false, error: null, documents: [] });
        setDocumentId("");
        return;
      }

      setDocumentsState((prev) => ({ ...prev, loading: true, error: null }));
      setChunksState({ loading: false, error: null, payload: null });

      try {
        const res = await fetch(`/api/systems/${systemId}/documents`);
        const data = (await res.json()) as SystemDocumentsResponse;

        if (cancelled) {
          return;
        }

        if (!data.ok) {
          setDocumentsState({ loading: false, error: data.error ?? "Failed to load documents.", documents: [] });
          setDocumentId("");
          return;
        }

        const docs = data.documents ?? [];
        setDocumentsState({ loading: false, error: null, documents: docs });
        setDocumentId((current) => (docs.some((doc) => doc.id === current) ? current : (docs[0]?.id ?? "")));
      } catch {
        if (!cancelled) {
          setDocumentsState({ loading: false, error: "Failed to load documents.", documents: [] });
          setDocumentId("");
        }
      }
    }

    void loadDocuments();

    return () => {
      cancelled = true;
    };
  }, [systemId]);

  async function loadChunks() {
    if (!documentId) {
      return;
    }

    setChunksState({ loading: true, error: null, payload: null });

    try {
      const res = await fetch(`/api/documents/${documentId}/chunks`);
      const data = (await res.json()) as DocumentChunksResponse;

      if (!data.ok) {
        setChunksState({ loading: false, error: data.error ?? "Failed to load chunks.", payload: null });
        return;
      }

      setChunksState({ loading: false, error: null, payload: data });
    } catch {
      setChunksState({ loading: false, error: "Failed to load chunks.", payload: null });
    }
  }

  async function requestOcr() {
    if (!documentId) {
      return;
    }

    setOcrRequestState({ loading: true, error: null, message: null });

    try {
      const res = await fetch(`/api/documents/${documentId}/ocr/request`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          mode: ocrMode,
          fullRun: ocrFullRun,
        }),
      });
      const data = (await res.json()) as {
        ok: boolean;
        error?: string;
        queued?: boolean;
        provider?: string;
      };

      if (!data.ok) {
        setOcrRequestState({
          loading: false,
          error: data.error ?? "Failed to request OCR.",
          message: null,
        });
        return;
      }

      setOcrRequestState({
        loading: false,
        error: null,
        message: data.queued ? `OCR job queued (${data.provider ?? "worker"}).` : "OCR request sent.",
      });

      await loadChunks();
    } catch {
      setOcrRequestState({
        loading: false,
        error: "Failed to request OCR.",
        message: null,
      });
    }
  }

  async function requestEntityExtraction() {
    if (!documentId) {
      return;
    }

    setEntityRequestState({ loading: true, error: null, message: null });

    try {
      const res = await fetch(`/api/documents/${documentId}/entities/reprocess`, {
        method: "POST",
      });
      const data = (await res.json()) as { ok: boolean; error?: string };

      if (!data.ok) {
        setEntityRequestState({
          loading: false,
          error: data.error ?? "Failed to queue entity extraction.",
          message: null,
        });
        return;
      }

      setEntityRequestState({
        loading: false,
        error: null,
        message: "Entity extraction queued.",
      });

      await loadChunks();
    } catch {
      setEntityRequestState({
        loading: false,
        error: "Failed to queue entity extraction.",
        message: null,
      });
    }
  }

  async function resetQueues() {
    setResetState({ loading: true, error: null, message: null });

    try {
      const res = await fetch("/api/debug/reset", { method: "POST" });
      const data = (await res.json()) as { ok: boolean; error?: string };

      if (!data.ok) {
        setResetState({
          loading: false,
          error: data.error ?? "Failed to reset queues.",
          message: null,
        });
        return;
      }

      setResetState({
        loading: false,
        error: null,
        message: "Queues cleared and statuses reset.",
      });

      await loadChunks();
    } catch {
      setResetState({
        loading: false,
        error: "Failed to reset queues.",
        message: null,
      });
    }
  }

  const selectedDocument = useMemo(
    () => documentsState.documents.find((doc) => doc.id === documentId) ?? null,
    [documentsState.documents, documentId],
  );

  if (systems.length === 0) {
    return null;
  }

  return (
    <section className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-sm font-medium text-zinc-200">Chunk Debug (Document Inspector)</h2>
        <span className="text-xs text-zinc-500">Inspect indexed text/chunks without curl</span>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <select
          value={systemId}
          onChange={(event) => setSystemId(event.target.value)}
          className="h-11 rounded-lg border border-zinc-700 bg-zinc-950 px-3 text-sm text-zinc-100 outline-none focus:border-zinc-500"
        >
          {systems.map((system) => (
            <option key={system.id} value={system.id}>
              {system.name}
            </option>
          ))}
        </select>

        <select
          value={documentId}
          onChange={(event) => setDocumentId(event.target.value)}
          disabled={documentsState.loading || documentsState.documents.length === 0}
          className="h-11 rounded-lg border border-zinc-700 bg-zinc-950 px-3 text-sm text-zinc-100 outline-none disabled:opacity-60 focus:border-zinc-500"
        >
          {documentsState.documents.length === 0 ? (
            <option value="">No documents</option>
          ) : (
            documentsState.documents.map((doc) => (
              <option key={doc.id} value={doc.id}>
                {doc.filePath.split("/").pop()} ({doc.extractionStatus}, chunks {doc._count.chunks})
              </option>
            ))
          )}
        </select>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => void loadChunks()}
          disabled={!documentId || chunksState.loading}
          className="h-10 rounded-lg bg-fuchsia-400 px-4 text-sm font-medium text-zinc-950 hover:bg-fuchsia-300 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {chunksState.loading ? "Loading chunks..." : "Load Chunks"}
        </button>

        <button
          type="button"
          onClick={() => void requestOcr()}
          disabled={!documentId || ocrRequestState.loading}
          className="h-10 rounded-lg bg-orange-400 px-4 text-sm font-medium text-zinc-950 hover:bg-orange-300 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {ocrRequestState.loading ? "Queueing OCR..." : "Request OCR"}
        </button>

        <button
          type="button"
          onClick={() => void requestEntityExtraction()}
          disabled={!documentId || entityRequestState.loading}
          className="h-10 rounded-lg bg-cyan-300 px-4 text-sm font-medium text-zinc-950 hover:bg-cyan-200 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {entityRequestState.loading ? "Queueing entities..." : "Re-run entities"}
        </button>

        <button
          type="button"
          onClick={() => void resetQueues()}
          disabled={resetState.loading}
          className="h-10 rounded-lg bg-zinc-700 px-4 text-sm font-medium text-zinc-100 hover:bg-zinc-600 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {resetState.loading ? "Resetting..." : "Reset queues"}
        </button>

        <select
          value={ocrMode}
          onChange={(event) => setOcrMode(event.target.value === "supplement" ? "supplement" : "replace")}
          className="h-10 rounded-lg border border-zinc-700 bg-zinc-950 px-3 text-xs text-zinc-100 outline-none focus:border-zinc-500"
        >
          <option value="replace">OCR mode: replace</option>
          <option value="supplement">OCR mode: supplement</option>
        </select>

        <label className="flex items-center gap-2 text-xs text-zinc-300">
          <input
            type="checkbox"
            checked={ocrFullRun}
            onChange={(event) => setOcrFullRun(event.target.checked)}
          />
          Full OCR run (disable dev page cap)
        </label>

        {documentsState.loading ? <span className="text-xs text-zinc-400">Loading documents...</span> : null}
        {documentsState.error ? <span className="text-xs text-rose-300">{documentsState.error}</span> : null}
        {ocrRequestState.error ? <span className="text-xs text-rose-300">{ocrRequestState.error}</span> : null}
        {ocrRequestState.message ? <span className="text-xs text-emerald-300">{ocrRequestState.message}</span> : null}
        {entityRequestState.error ? <span className="text-xs text-rose-300">{entityRequestState.error}</span> : null}
        {entityRequestState.message ? <span className="text-xs text-emerald-300">{entityRequestState.message}</span> : null}
        {resetState.error ? <span className="text-xs text-rose-300">{resetState.error}</span> : null}
        {resetState.message ? <span className="text-xs text-emerald-300">{resetState.message}</span> : null}
      </div>

      {selectedDocument ? (
        <div className="mt-4 rounded-lg border border-zinc-800 bg-zinc-950/60 p-3 text-xs">
          <div className="max-h-48 overflow-y-auto pr-2">
          <p className="text-zinc-300">
            <span className="text-zinc-500">docId:</span> <code>{selectedDocument.id}</code>
          </p>
          <p className="mt-1 break-all text-zinc-300">
            <span className="text-zinc-500">file:</span> {selectedDocument.filePath}
          </p>
          <p className="mt-1 text-zinc-300">
            <span className="text-zinc-500">status:</span> {selectedDocument.extractionStatus}
            {" • "}
            <span className="text-zinc-500">chunks:</span> {selectedDocument._count.chunks}
          </p>
          <p className="mt-1 text-zinc-300">
            <span className="text-zinc-500">diagnostics:</span> textLen=
            {selectedDocument.extractedTextLength ?? "null"}
            {" • "}pages={selectedDocument.extractedPageCount ?? "null"}
            {" • "}extractMs={selectedDocument.extractionDurationMs ?? "null"}
          </p>
          <p className="mt-1 text-zinc-300">
            <span className="text-zinc-500">ocr:</span> {selectedDocument.ocrStatus}
            {selectedDocument.ocrMode ? ` • mode=${selectedDocument.ocrMode}` : ""}
            {selectedDocument.ocrReason ? ` • ${selectedDocument.ocrReason}` : ""}
            {selectedDocument.ocrRequestedAt ? ` • requested ${selectedDocument.ocrRequestedAt}` : ""}
          </p>
          <p className="mt-1 text-zinc-300">
            <span className="text-zinc-500">ocr progress:</span>{" "}
            {selectedDocument.ocrProgressCurrentPage ?? 0}/
            {selectedDocument.ocrProgressTotalPages ?? "?"}
            {selectedDocument.ocrProgressMessage ? ` • ${selectedDocument.ocrProgressMessage}` : ""}
            {selectedDocument.ocrProgressUpdatedAt ? ` • updated ${selectedDocument.ocrProgressUpdatedAt}` : ""}
          </p>
          <p className="mt-1 text-zinc-300">
            <span className="text-zinc-500">entity status:</span>{" "}
            {selectedDocument.entityStatus}
            {selectedDocument.entityProgressMessage ? ` • ${selectedDocument.entityProgressMessage}` : ""}
            {selectedDocument.entityProgressUpdatedAt
              ? ` • updated ${selectedDocument.entityProgressUpdatedAt}`
              : ""}
          </p>
          <p className="mt-1 text-zinc-300">
            <span className="text-zinc-500">entity counts:</span>{" "}
            extracted={selectedDocument.entityExtractedCount ?? 0}
            {" • "}rules={selectedDocument.entityRuleLinkCount ?? 0}
            {" • "}images={selectedDocument.entityImageCount ?? 0}
          </p>
          {selectedDocument.entityError ? (
            <p className="mt-1 break-words text-amber-300">
              <span className="text-zinc-500">entity error:</span> {selectedDocument.entityError}
            </p>
          ) : null}
          {selectedDocument.ocrError ? (
            <p className="mt-1 break-words text-amber-300">
              <span className="text-zinc-500">ocrError:</span> {selectedDocument.ocrError}
            </p>
          ) : null}
          {selectedDocument.extractionError ? (
            <p className="mt-1 break-words text-amber-300">
              <span className="text-zinc-500">error:</span> {selectedDocument.extractionError}
            </p>
          ) : null}
          </div>
          <p className="mt-2">
            <a
              href={`/api/documents/${selectedDocument.id}/chunks`}
              className="text-zinc-300 underline decoration-zinc-700 underline-offset-2 hover:text-zinc-100"
              target="_blank"
              rel="noreferrer"
            >
              Open chunks JSON
            </a>
          </p>
        </div>
      ) : null}

      {chunksState.error ? (
        <p className="mt-4 rounded-lg border border-rose-800 bg-rose-950/20 px-3 py-2 text-sm text-rose-200">
          {chunksState.error}
        </p>
      ) : null}

      {chunksState.payload?.ok && chunksState.payload.chunks ? (
        <div className="mt-4 space-y-3">
          <div className="rounded-lg border border-zinc-800 bg-zinc-950/60 px-3 py-2 text-xs text-zinc-300">
            <span className="text-zinc-500">loaded chunks:</span> {chunksState.payload.chunks.length}
            {" • "}
            <span className="text-zinc-500">with embeddings:</span>{" "}
            {chunksState.payload.chunks.filter((chunk) => chunk.hasEmbedding).length}
          </div>

          <div className="max-h-[520px] overflow-y-auto pr-2">
            <ul className="space-y-2">
              {chunksState.payload.chunks.map((chunk) => (
                <li key={chunk.id} className="rounded-lg border border-zinc-800 bg-zinc-950/60 p-3">
                <p className="text-xs text-zinc-400">
                  chunk {chunk.chunkIndex} • id <code>{chunk.id}</code>
                  {chunk.pageNumber !== null ? ` • page ${chunk.pageNumber}` : ""}
                  {chunk.hasEmbedding ? " • embedded" : " • no-embedding"}
                </p>
                {chunk.chapterHint ? (
                  <p className="mt-1 text-xs text-zinc-300">
                    <span className="text-zinc-500">chapter:</span> {chunk.chapterHint}
                  </p>
                ) : null}
                <pre className="mt-2 max-h-40 overflow-y-auto overflow-x-auto whitespace-pre-wrap rounded border border-zinc-800 bg-zinc-900/70 p-2 text-xs text-zinc-200">
                  {chunk.content}
                </pre>
                </li>
              ))}
            </ul>
          </div>
        </div>
      ) : null}
    </section>
  );
}
