"use client";

type OpenApiPaths = {
  paths?: Record<string, Record<string, { summary?: string }>>;
};

type PostmanRequest = {
  name?: string;
  item?: PostmanRequest[];
  request?: { method?: string; url?: { raw?: string; path?: string[] } };
};

export function TablePreview({ data, format }: { data: unknown; format: "openapi" | "postman" }) {
  if (format === "openapi") {
    const spec = data as OpenApiPaths;
    const rows: { method: string; path: string; summary: string }[] = [];
    const paths = spec?.paths ?? {};

    Object.entries(paths).forEach(([path, methods]) => {
      Object.entries(methods ?? {}).forEach(([method, op]) => {
        rows.push({
          method: method.toUpperCase(),
          path,
          summary: (op as { summary?: string }).summary ?? "",
        });
      });
    });

    if (rows.length === 0) {
      return <p className="text-sm text-muted-foreground">No endpoints found in OpenAPI spec.</p>;
    }

    return (
      <div className="max-h-[520px] overflow-auto">
        <table className="min-w-full border-collapse text-left text-xs">
          <thead className="border-b border-border bg-muted/60 text-[11px] uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-3 py-2">Method</th>
              <th className="px-3 py-2">Path</th>
              <th className="px-3 py-2">Summary</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, idx) => (
              <tr key={`${row.method}-${row.path}-${idx}`} className="border-b border-border/60 last:border-0">
                <td className="whitespace-nowrap px-3 py-2 align-top font-mono text-[11px] font-semibold">
                  {row.method}
                </td>
                <td className="whitespace-nowrap px-3 py-2 align-top font-mono text-[11px] text-foreground">
                  {row.path}
                </td>
                <td className="px-3 py-2 align-top text-[11px] text-muted-foreground">{row.summary}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  const collection = data as { item?: PostmanRequest[] };

  const rows: { folder: string; name: string; method: string; path: string }[] = [];

  const walkItems = (items: PostmanRequest[] | undefined, folder: string) => {
    if (!items) return;
    for (const item of items) {
      if (Array.isArray(item.item)) {
        walkItems(item.item, item.name || folder);
      } else if (item.request) {
        const method = (item.request.method || "").toUpperCase();
        const url = item.request.url || {};
        const raw = url.raw || "";
        const path = Array.isArray(url.path) ? `/${url.path.join("/")}` : raw;
        rows.push({
          folder,
          name: item.name || path,
          method,
          path,
        });
      }
    }
  };

  walkItems(collection.item ?? [], "");

  if (rows.length === 0) {
    return <p className="text-sm text-muted-foreground">No requests found in Postman collection.</p>;
  }

  return (
    <div className="max-h-[520px] overflow-auto">
      <table className="min-w-full border-collapse text-left text-xs">
        <thead className="border-b border-border bg-muted/60 text-[11px] uppercase tracking-wide text-muted-foreground">
          <tr>
            <th className="px-3 py-2">Folder</th>
            <th className="px-3 py-2">Name</th>
            <th className="px-3 py-2">Method</th>
            <th className="px-3 py-2">Path</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, idx) => (
            <tr key={`${row.folder}-${row.name}-${idx}`} className="border-b border-border/60 last:border-0">
              <td className="px-3 py-2 align-top text-[11px] text-muted-foreground">{row.folder || "—"}</td>
              <td className="px-3 py-2 align-top text-[11px] font-semibold text-foreground">{row.name}</td>
              <td className="whitespace-nowrap px-3 py-2 align-top font-mono text-[11px] font-semibold">
                {row.method}
              </td>
              <td className="whitespace-nowrap px-3 py-2 align-top font-mono text-[11px] text-foreground">
                {row.path}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

