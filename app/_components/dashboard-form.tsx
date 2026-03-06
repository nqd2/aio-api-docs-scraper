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
    <section className="rounded-2xl border border-border bg-card/60 p-6 shadow-sm backdrop-blur sm:p-8">
      <div className="max-w-3xl space-y-3">
        <h1 className="text-[32px] font-semibold tracking-tight text-foreground sm:text-[36px]">
          Turn API documentation website <br/> into OpenAPI &amp; Postman-ready formats
        </h1>
        <p className="text-sm text-muted-foreground sm:text-base">
          Tired of reading the docs? Paste the API docs URL (Swagger/Redoc/Docusaurus), preview, and
          download OpenAPI/Postman JSON formats and let your coding agent do the rest.
        </p>
        <div className="mt-2 flex flex-wrap gap-2 text-[11px] font-medium text-muted-foreground">
          <span className="rounded-full bg-muted px-2 py-1">Step 1 · Enter docs URL</span>
          <span className="rounded-full bg-muted px-2 py-1">Step 2 · Scrape</span>
          <span className="rounded-full bg-muted px-2 py-1">Step 3 · Preview</span>
          <span className="rounded-full bg-muted px-2 py-1">Step 4 · Download</span>
        </div>
      </div>

      <div className="mt-5 grid gap-3 lg:grid-cols-12">
        <div className="lg:col-span-7">
          <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Docs URL</label>
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
          <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Docs type</label>
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
            className="h-11 w-full rounded-xl bg-accent px-4 text-sm font-semibold text-accent-foreground shadow-md shadow-accent/30 transition hover:-translate-y-[1px] hover:shadow-lg hover:shadow-accent/40 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isPending ? "Running..." : "Run"}
          </button>
        </div>
      </div>
    </section>
  );
}

