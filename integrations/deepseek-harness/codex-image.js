import { readFile, realpath } from "node:fs/promises";
import { basename, extname, resolve, sep } from "node:path";

const MEDIA_TYPES = {
  ".gif": "image/gif",
  ".jpeg": "image/jpeg",
  ".jpg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
};

export async function importCodexImage(path, roots, attachments) {
  const target = await allowedRealPath(path, roots);
  const mediaType = MEDIA_TYPES[extname(target).toLowerCase()];
  if (!mediaType) throw new Error("unsupported Codex image type");
  const data = await readFile(target);
  return attachments.saveImage({ data, mediaType, name: basename(target) });
}

export async function importCodexGeneratedImage(item, roots, attachments) {
  if (item.savedPath) return importCodexImage(item.savedPath, roots, attachments);
  const result = String(item.result ?? "");
  const matched = result.match(/^data:(image\/(?:png|jpeg|webp|gif));base64,(.+)$/s);
  const mediaType = matched?.[1] ?? "image/png";
  const encoded = matched?.[2] ?? result;
  if (!encoded || !/^[A-Za-z0-9+/\r\n]+={0,2}$/.test(encoded)) {
    throw new Error("Codex image result is not valid base64");
  }
  const data = Buffer.from(encoded, "base64");
  if (data.length === 0 || data.length > 25 * 1024 * 1024) {
    throw new Error("Codex image result has an invalid size");
  }
  return attachments.saveImage({ data, mediaType, name: `codex-${item.id}.${extensionFor(mediaType)}` });
}

export async function allowedRealPath(path, roots) {
  const target = await realpath(resolve(path));
  const allowedRoots = await Promise.all(roots.map(root => realpath(resolve(root)).catch(() => null)));
  if (!allowedRoots.some(root => root && (target === root || target.startsWith(`${root}${sep}`)))) {
    throw new Error("image path is outside the Codex workspace");
  }
  return target;
}

function extensionFor(mediaType) {
  if (mediaType === "image/jpeg") return "jpg";
  return mediaType.slice("image/".length);
}
