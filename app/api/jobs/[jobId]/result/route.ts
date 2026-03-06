import { NextResponse } from "next/server";
import { z } from "zod";
import { getJob } from "../../../../../lib/jobs/store";
import { toYaml } from "../../../../../lib/utils/to-yaml";

export const dynamic = "force-dynamic";

const QuerySchema = z.object({
  format: z.enum(["openapi", "postman"]),
  mode: z.enum(["json", "preview", "download"]).optional().default("json"),
  limit: z.coerce.number().int().min(1000).max(2_000_000).optional().default(200_000),
  as: z.enum(["json", "yaml"]).optional().default("json"),
});

function filenameFor(format: "openapi" | "postman", as: "json" | "yaml") {
  const base = format === "openapi" ? "openapi-spec" : "postman-collection";
  const ext = as === "yaml" ? "yaml" : "json";
  return `${base}.${ext}`;
}

export async function GET(request: Request, { params }: { params: Promise<{ jobId: string }> }) {
  const { jobId } = await params;
  const job = getJob(jobId);
  if (!job) return NextResponse.json({ error: "Job not found" }, { status: 404 });
  if (!job.result) return NextResponse.json({ error: "Job has no result yet" }, { status: 409 });

  const parsed = QuerySchema.safeParse(Object.fromEntries(new URL(request.url).searchParams.entries()));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid query", details: parsed.error.flatten() }, { status: 400 });
  }

  const { format, mode, limit, as } = parsed.data;
  const payload = format === "openapi" ? job.result.openapi : job.result.postman;

  if (mode === "preview") {
    let text: string;
    try {
      text = JSON.stringify(payload, null, 2);
    } catch {
      text = String(payload);
    }
    const truncated = text.length > limit ? `${text.slice(0, limit)}\n\n/* ... truncated (${text.length - limit} chars) ... */\n` : text;
    return new Response(truncated, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-store",
      },
    });
  }

  if (as === "yaml") {
    const text = toYaml(payload);
    const res = new Response(text, {
      headers: {
        "Content-Type": "text/yaml; charset=utf-8",
        "Cache-Control": "no-store",
      },
    });
    if (mode === "download") {
      res.headers.set("Content-Disposition", `attachment; filename="${filenameFor(format, as)}"`);
    }
    return res;
  }

  // Pretty-printed JSON (so downloads and direct hits are readable)
  const jsonText = JSON.stringify(payload, null, 2);
  const res = new Response(jsonText, {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
  if (mode === "download") {
    res.headers.set("Content-Disposition", `attachment; filename="${filenameFor(format, as)}"`);
  }
  return res;
}

