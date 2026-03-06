import { getJob, subscribe } from "../../../../../lib/jobs/store";

export const dynamic = "force-dynamic";

function sseChunk(params: { id: number; event: string; data: unknown }) {
  return `id: ${params.id}\nevent: ${params.event}\ndata: ${JSON.stringify(params.data)}\n\n`;
}

export async function GET(request: Request, { params }: { params: Promise<{ jobId: string }> }) {
  const { jobId } = await params;
  const job = getJob(jobId);
  if (!job) return new Response(JSON.stringify({ error: "Job not found" }), { status: 404 });

  const encoder = new TextEncoder();
  const { signal } = request;

  let unsubscribe: (() => void) | undefined;

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      // Initial snapshot
      controller.enqueue(encoder.encode(sseChunk({ id: 0, event: "snapshot", data: job })));

      unsubscribe = subscribe(jobId, (evt) => {
        controller.enqueue(encoder.encode(sseChunk({ id: evt.id, event: evt.type, data: evt.data })));
      });
    },
    cancel() {
      unsubscribe?.();
    },
  });

  signal.addEventListener(
    "abort",
    () => {
      unsubscribe?.();
    },
    { once: true },
  );

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}

