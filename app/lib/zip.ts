/**
 * Minimal ZIP reader + ICCPlus image-inlining.
 *
 * ICCPlus can export a project as a `.zip` containing `project.json` plus
 * `images/…` files (the "export with images" flow). This module mirrors the
 * original `loadFromDisk` zip path: parse the zip client-side (browser-native
 * `DecompressionStream`, no dependencies), then replace every image path in
 * the document with its data URL, exactly like the original `replaceImages`.
 */

import { visitAppImageFields } from "@shared/cyoa";

/** Prefer project.json over unrelated manifests bundled in viewer exports. */
export function zipProjectEntry(files: Map<string, Uint8Array>): [string, Uint8Array] {
  const entries = [...files.entries()].filter(([name]) => !name.startsWith("__MACOSX/"));
  const project =
    entries.find(([name]) => name.toLowerCase() === "project.json") ??
    entries.find(([name]) => /(^|\/)project\.json$/i.test(name));
  if (project) return project;
  const json = entries.filter(([name]) => /\.json$/i.test(name));
  if (json.length === 1) return json[0];
  throw new Error("The zip must contain project.json or exactly one JSON document.");
}

/** Unzip into a name -> bytes map. Supports stored + deflate-raw entries. */
export async function unzip(buffer: ArrayBuffer): Promise<Map<string, Uint8Array>> {
  const bytes = new Uint8Array(buffer);
  const readU16 = (off: number): number => bytes[off] | (bytes[off + 1] << 8);
  const readU32 = (off: number): number =>
    (bytes[off] | (bytes[off + 1] << 8) | (bytes[off + 2] << 16) | (bytes[off + 3] << 24)) >>> 0;

  // End Of Central Directory: signature 0x06054b50, scanned from the tail.
  let eocd = -1;
  const min = Math.max(0, bytes.length - 22 - 65535);
  for (let i = bytes.length - 22; i >= min; i--) {
    if (
      bytes[i] === 0x50 &&
      bytes[i + 1] === 0x4b &&
      bytes[i + 2] === 0x05 &&
      bytes[i + 3] === 0x06
    ) {
      eocd = i;
      break;
    }
  }
  if (eocd === -1) throw new Error("Not a valid zip file");

  const totalEntries = readU16(eocd + 10);
  const cdOffset = readU32(eocd + 16);
  const files = new Map<string, Uint8Array>();
  let offset = cdOffset;

  for (let i = 0; i < totalEntries; i++) {
    if (readU32(offset) !== 0x02014b50) throw new Error("Corrupt zip central directory");
    const method = readU16(offset + 10);
    const compSize = readU32(offset + 20);
    const nameLen = readU16(offset + 28);
    const extraLen = readU16(offset + 30);
    const commentLen = readU16(offset + 32);
    const localOffset = readU32(offset + 42);
    const name = new TextDecoder().decode(bytes.subarray(offset + 46, offset + 46 + nameLen));

    if (readU32(localOffset) !== 0x04034b50) throw new Error("Corrupt zip local header");
    const lNameLen = readU16(localOffset + 26);
    const lExtraLen = readU16(localOffset + 28);
    const dataStart = localOffset + 30 + lNameLen + lExtraLen;
    const raw = bytes.subarray(dataStart, dataStart + compSize);

    if (method === 0) {
      files.set(name, raw);
    } else if (method === 8) {
      if (typeof DecompressionStream === "undefined") {
        throw new Error("This browser cannot decompress zip files; export a .json instead.");
      }
      const stream = new Blob([raw]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
      files.set(name, new Uint8Array(await new Response(stream).arrayBuffer()));
    } else {
      throw new Error(`Unsupported zip compression method: ${method}`);
    }

    offset += 46 + nameLen + extraLen + commentLen;
  }
  return files;
}

function mimeFromName(name: string): string {
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  switch (ext) {
    case "png":
      return "image/png";
    case "jpg":
    case "jpeg":
      return "image/jpeg";
    case "gif":
      return "image/gif";
    case "webp":
      return "image/webp";
    case "avif":
      return "image/avif";
    case "svg":
      return "image/svg+xml";
    case "bmp":
      return "image/bmp";
    case "ico":
      return "image/x-icon";
    default:
      return "image/png";
  }
}

function bytesToDataUrl(bytes: Uint8Array, mime: string): string {
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return `data:${mime};base64,${btoa(binary)}`;
}

/**
 * Replaces `images/…` paths inside an ICCPlus document with their data URLs
 * (port of the original `replaceImages`). Mutates and returns the document.
 */
export function inlineZipImages(
  doc: Record<string, unknown>,
  files: Map<string, Uint8Array>,
  projectPath = "project.json",
): Record<string, unknown> {
  const images = new Map<string, string>();

  const directory = projectPath.slice(0, projectPath.lastIndexOf("/") + 1);
  visitAppImageFields(
    doc,
    (record, key) => {
      const ref = String(record[key]);
      if (/^(?:[a-z][a-z\d+.-]*:|\/\/)/i.test(ref)) return;
      const path = ref.replace(/^\.\//, "");
      const name = files.has(directory + path) ? directory + path : path;
      const bytes = files.get(name);
      if (!bytes || name.endsWith("/")) return;
      let replacement = images.get(name);
      if (!replacement) {
        replacement = bytesToDataUrl(bytes, mimeFromName(name));
        images.set(name, replacement);
      }
      record[key] = replacement;
    },
    true,
  );
  return doc;
}
