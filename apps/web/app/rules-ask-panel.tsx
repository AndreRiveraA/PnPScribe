"use client";

import { FormEvent, useState } from "react";

type SystemOption = {
  id: string;
  name: string;
};

type AskResult = {
  ok: boolean;
  answer?: string;
  citations?: Array<{
    chunkId: string;
    filePath: string;
    chunkIndex: number;
    pageNumber: number | null;
    chapterHint: string | null;
    excerpt: string;
  }>;
  error?: string;
};

export function RulesAskPanel({ systems }: { systems: SystemOption[] }) {
  const [systemId, setSystemId] = useState(systems[0]?.id ?? "");
  const [question, setQuestion] = useState("");
  const [tier, setTier] = useState<"cheap" | "strong">("cheap");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AskResult | null>(null);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!systemId || !question.trim()) {
      return;
    }

    setLoading(true);
    setResult(null);

    try {
      const res = await fetch(`/api/systems/${systemId}/ask`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          question: question.trim(),
          tier,
        }),
      });

      const data = (await res.json()) as AskResult;
      setResult(data);
    } catch {
      setResult({ ok: false, error: "Request failed." });
    } finally {
      setLoading(false);
    }
  }

  if (systems.length === 0) {
    return null;
  }

  return (
    <section className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-5">
      <h2 className="mb-4 text-sm font-medium text-zinc-200">Rules Ask (JSON-backed MVP)</h2>
      <form onSubmit={onSubmit} className="flex flex-col gap-3">
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
            value={tier}
            onChange={(event) => setTier(event.target.value === "strong" ? "strong" : "cheap")}
            className="h-11 rounded-lg border border-zinc-700 bg-zinc-950 px-3 text-sm text-zinc-100 outline-none focus:border-zinc-500"
          >
            <option value="cheap">cheap</option>
            <option value="strong">strong</option>
          </select>
        </div>

        <textarea
          value={question}
          onChange={(event) => setQuestion(event.target.value)}
          rows={4}
          placeholder="Ask a rules question for the selected system..."
          className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none placeholder:text-zinc-500 focus:border-zinc-500"
        />

        <button
          type="submit"
          disabled={loading || !question.trim()}
          className="h-11 rounded-lg bg-sky-500 px-4 text-sm font-medium text-zinc-950 hover:bg-sky-400 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? "Asking..." : "Ask Rules"}
        </button>
      </form>

      {result ? (
        <div className="mt-4 space-y-3">
          {"error" in result && result.error ? (
            <p className="rounded-lg border border-rose-800 bg-rose-950/30 px-3 py-2 text-sm text-rose-200">
              {result.error}
            </p>
          ) : null}

          {result.ok && result.answer ? (
            <div className="rounded-lg border border-zinc-800 bg-zinc-950/70 p-3">
              <p className="text-xs uppercase tracking-[0.15em] text-zinc-500">Answer</p>
              <p className="mt-2 whitespace-pre-wrap text-sm text-zinc-100">{result.answer}</p>
            </div>
          ) : null}

          {result.ok && result.citations && result.citations.length > 0 ? (
            <div className="rounded-lg border border-zinc-800 bg-zinc-950/70 p-3">
              <p className="text-xs uppercase tracking-[0.15em] text-zinc-500">Citations</p>
              <ul className="mt-2 space-y-2">
                {result.citations.map((citation, index) => (
                  <li key={`${citation.chunkId}-${index}`} className="rounded border border-zinc-800 px-3 py-2">
                    <p className="text-xs text-zinc-400">
                      [{index + 1}] {citation.filePath} • chunk {citation.chunkIndex}
                      {citation.pageNumber !== null ? ` • page ${citation.pageNumber}` : ""}
                      {citation.chapterHint ? ` • ${citation.chapterHint}` : ""}
                    </p>
                    <p className="mt-1 text-xs text-zinc-300">{citation.excerpt}</p>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
