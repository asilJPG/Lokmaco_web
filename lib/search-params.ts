export function toURLSearchParams(sp: { [k: string]: string | string[] | undefined }): URLSearchParams {
  const out = new URLSearchParams();
  for (const [k, v] of Object.entries(sp)) {
    if (v === undefined) continue;
    if (Array.isArray(v)) for (const x of v) out.append(k, x);
    else out.set(k, v);
  }
  return out;
}
