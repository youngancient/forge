import { put } from "@vercel/blob";

// design.md decision #14: blob files are write-once and never mutated in
// place, so they're safe to cache aggressively and permanently.
const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

export async function uploadBlob(
  pathname: string,
  data: Buffer | Blob | string,
  contentType: string,
): Promise<string> {
  const blob = await put(pathname, data, {
    access: "public",
    addRandomSuffix: true,
    contentType,
    cacheControlMaxAge: ONE_YEAR_SECONDS,
  });
  return blob.url;
}
