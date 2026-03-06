"use client";

import type { Dispatch, SetStateAction } from "react";
import type { DocsType } from "./dashboard";

type Props = {
  url: string;
  docsType: DocsType;
  urlError: string | null;
  isPending: boolean;
  setUrl: Dispatch<SetStateAction<string>>;
  setDocsType: Dispatch<SetStateAction<DocsType>>;
  setUrlError: Dispatch<SetStateAction<string | null>>;
  validateUrl: (value: string) => string | null;
  onSubmit: () => void;
};

export function DashboardForm({
  url,
  docsType,
  urlError,
  isPending,
  setUrl,
  setDocsType,
  setUrlError,
  validateUrl,
  onSubmit,
}: Props) {
  return (
    <section className="rounded-2xl border border-border bg-card/60 p-4 shadow-sm backdrop-blur sm:p-6">
      <div className="max-w-3xl space-y-3">
        <h1 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">Dashboard</h1>
        <p className="text-sm text-muted-foreground sm:text-base">
          Paste an API docs URL (Swagger/Redoc/Docusaurus). Track scraping progress in realtime, preview the JSON, and
          download OpenAPI/Postman formats.
        </p>
      </div>

      <div className="mt-5 grid gap-3 lg:grid-cols-12">
        <div className="lg:col-span-7">
          <label className="text-sm font-semibold text-foreground">Docs URL</label>
          <input
            value={url}
            onChange={(e) => {
              setUrl(e.target.value);
              if (urlError) setUrlError(null);
            }}
            onBlur={() => setUrlError(validateUrl(url))}
            placeholder="https://example.com/api"
            className="mt-2 h-11 w-full rounded-xl border border-border bg-background px-3 text-sm text-foreground shadow-sm outline-none transition focus:border-accent focus:ring-4 focus:ring-accent/10"
            inputMode="url"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
          />
          {urlError ? <p className="mt-2 text-sm text-rose-600 dark:text-rose-300">{urlError}</p> : null}
        </div>

        <div className="lg:col-span-3">
          <label className="text-sm font-semibold text-foreground">Docs type</label>
          <select
            value={docsType}
            onChange={(e) => setDocsType(e.target.value as DocsType)}
            className="mt-2 h-11 w-full rounded-xl border border-border bg-background px-3 text-sm text-foreground shadow-sm outline-none transition focus:border-accent focus:ring-4 focus:ring-accent/10"
          >
            <option value="auto">Auto</option>
            <option value="swagger">Swagger</option>
            <option value="redoc">Redoc</option>
            <option value="redocly">Redocly</option>
            <option value="docusaurus">Docusaurus</option>
          </select>
        </div>

        <div className="lg:col-span-2 lg:self-end">
          <button
            type="button"
            disabled={isPending}
            onClick={onSubmit}
            className="h-11 w-full rounded-xl bg-accent px-4 text-sm font-semibold text-accent-foreground shadow-sm transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isPending ? "Running..." : "Run"}
          </button>
        </div>
      </div>
    </section>
  );
}

