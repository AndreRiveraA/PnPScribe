"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

type SystemOption = {
  id: string;
  name: string;
};

type UploadResult = {
  ok: boolean;
  error?: string;
  document?: {
    extractionStatus?: string;
    extractionError?: string | null;
  };
  processing?: {
    chunkCount?: number;
    groupCount?: number;
    chapterCount?: number;
    embeddedCount?: number;
    embeddingError?: string | null;
  };
};

type UploadStep = "idle" | "uploading" | "extracting" | "chunking" | "embedding" | "done" | "error";

export function DocumentUploadPanel({ systems }: { systems: SystemOption[] }) {
  const router = useRouter();
  const [systemId, setSystemId] = useState(systems[0]?.id ?? "");
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<UploadResult | null>(null);
  const [step, setStep] = useState<UploadStep>("idle");

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!systemId || !file) {
      return;
    }

    setUploading(true);
    setResult(null);
    setStep("uploading");

    try {
      const formData = new FormData();
      formData.append("systemId", systemId);
      formData.append("file", file);

      const res = await fetch("/api/documents/upload", {
        method: "POST",
        body: formData,
      });

      setStep("extracting");
      const data = (await res.json()) as UploadResult;
      setResult(data);

      if (data.ok) {
        setStep("chunking");
        setFile(null);
        router.refresh();
        setStep("embedding");
        setStep("done");
      } else {
        setStep("error");
      }
    } catch {
      setResult({ ok: false, error: "Upload request failed." });
      setStep("error");
    } finally {
      setUploading(false);
    }
  }

  if (systems.length === 0) {
    return null;
  }

  return (
    <section className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-5">
      <h2 className="mb-4 text-sm font-medium text-zinc-200">Upload Rulebook PDF</h2>
      <form onSubmit={onSubmit} className="flex flex-col gap-3">
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

        <input
          key={file ? "has-file" : "no-file"}
          type="file"
          accept="application/pdf,.pdf"
          onChange={(event) => setFile(event.target.files?.[0] ?? null)}
          className="block w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-200 file:mr-3 file:rounded-md file:border-0 file:bg-zinc-800 file:px-3 file:py-2 file:text-xs file:text-zinc-100 hover:file:bg-zinc-700"
        />

        <button
          type="submit"
          disabled={uploading || !systemId || !file}
          className="h-11 rounded-lg bg-amber-400 px-4 text-sm font-medium text-zinc-950 hover:bg-amber-300 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {uploading ? "Uploading..." : "Upload PDF"}
        </button>
      </form>

      {result ? (
        <div className="mt-4 space-y-2">
          <div className="rounded-lg border border-zinc-800 bg-zinc-950/60 px-3 py-2 text-xs text-zinc-300">
            <span className="text-zinc-500">status:</span>{" "}
            {step === "uploading" ? "Uploading file" : null}
            {step === "extracting" ? "Extracting text" : null}
            {step === "chunking" ? "Chunking + grouping" : null}
            {step === "embedding" ? "Embedding chunks" : null}
            {step === "done" ? "Completed" : null}
            {step === "error" ? "Failed" : null}
            {step === "idle" ? "Idle" : null}
          </div>
          {result.ok ? (
            <div className="rounded-lg border border-emerald-800 bg-emerald-950/20 px-3 py-2 text-sm text-emerald-200">
              Upload completed.
              {result.document?.extractionStatus
                ? ` Extraction: ${result.document.extractionStatus}.`
                : ""}
              {typeof result.processing?.chunkCount === "number"
                ? ` Chunks: ${result.processing.chunkCount}.`
                : ""}
              {typeof result.processing?.groupCount === "number"
                ? ` Groups: ${result.processing.groupCount}.`
                : ""}
              {typeof result.processing?.chapterCount === "number"
                ? ` Chapters: ${result.processing.chapterCount}.`
                : ""}
              {typeof result.processing?.embeddedCount === "number"
                ? ` Embedded: ${result.processing.embeddedCount}.`
                : ""}
            </div>
          ) : (
            <div className="rounded-lg border border-rose-800 bg-rose-950/20 px-3 py-2 text-sm text-rose-200">
              {result.error ?? "Upload failed."}
            </div>
          )}

          {result.document?.extractionError ? (
            <p className="text-xs text-amber-300">
              Extraction error: {result.document.extractionError}
            </p>
          ) : null}

          {result.processing?.embeddingError ? (
            <p className="text-xs text-amber-300">
              Embedding error: {result.processing.embeddingError}
            </p>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
