type JsonObject = Record<string, unknown>;

function isPlainObject(v: unknown): v is JsonObject {
  return v !== null && typeof v === "object" && !Array.isArray(v);
}

/** Deep-merge plain objects; arrays and primitives from patch replace. */
export function deepMerge(base: unknown, patch: unknown): unknown {
  if (!isPlainObject(base)) return patch !== undefined ? patch : base;
  if (!isPlainObject(patch)) return patch;
  const out: JsonObject = { ...base };
  for (const [k, pv] of Object.entries(patch)) {
    const bv = base[k];
    if (isPlainObject(bv) && isPlainObject(pv)) {
      out[k] = deepMerge(bv, pv) as JsonObject;
    } else {
      out[k] = pv;
    }
  }
  return out;
}

export function mergeOpenApiTemplate(template: unknown, fromLlm: unknown): unknown {
  return deepMerge(template, fromLlm);
}

export function mergePostmanTemplate(template: unknown, fromLlm: unknown): unknown {
  const merged = deepMerge(template, fromLlm) as JsonObject;
  if (isPlainObject(merged.info)) {
    merged.info = { ...merged.info, _postman_id: crypto.randomUUID() };
  }
  return merged;
}
