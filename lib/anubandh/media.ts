import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { DomainError, getStore, type FamilyStore } from "./store";
import type { Member } from "./types";

export function storageDirectory() {
  const fallback = path.join(process.cwd(), ".data", "anubandh");
  const database = process.env.ANUBANDH_DATABASE_PATH;
  if (database && path.resolve(database) !== path.join(fallback, "family.db") && !process.env.ANUBANDH_STORAGE_PATH)
    throw new Error("A custom ANUBANDH_DATABASE_PATH requires an explicit, separate ANUBANDH_STORAGE_PATH.");
  return process.env.ANUBANDH_STORAGE_PATH ?? fallback;
}
export function secret(name: string) {
  const directory = storageDirectory();
  fs.mkdirSync(directory, { recursive: true, mode: 0o700 });
  const filename = path.join(directory, name);
  try {
    fs.writeFileSync(filename, randomBytes(32), { flag: "wx", mode: 0o600 });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
  }
  const key = fs.readFileSync(filename);
  if (key.length !== 32) throw new Error("Invalid vault key.");
  return key;
}
function mediaDirectory() {
  const directory = path.join(storageDirectory(), "media");
  fs.mkdirSync(directory, { recursive: true, mode: 0o700 });
  return directory;
}
export async function uploadMedia(member: Member, file: File) {
  if (file.size <= 0 || file.size > 8 * 1024 * 1024)
    throw new DomainError("Choose a photo or recording smaller than 8 MB.");
  let bytes = Buffer.from(await file.arrayBuffer());
  let mime = file.type.split(";")[0];
  if (["image/jpeg", "image/png", "image/webp"].includes(mime)) {
    try {
      bytes = await sharp(bytes, { limitInputPixels: 25_000_000 })
        .rotate()
        .resize(1600, 1600, { fit: "inside", withoutEnlargement: true })
        .jpeg({ quality: 85 })
        .toBuffer();
      mime = "image/jpeg";
    } catch {
      throw new DomainError(
        "This photo could not be opened. Choose a JPEG, PNG, or WebP image.",
      );
    }
  } else if (
    [
      "audio/webm",
      "audio/ogg",
      "audio/mp4",
      "audio/wav",
      "audio/mpeg",
    ].includes(mime)
  ) {
    const webm = bytes
      .subarray(0, 4)
      .equals(Buffer.from([0x1a, 0x45, 0xdf, 0xa3]));
    const ogg = bytes.subarray(0, 4).toString() === "OggS";
    const wav =
      bytes.subarray(0, 4).toString() === "RIFF" &&
      bytes.subarray(8, 12).toString() === "WAVE";
    const mp4 = bytes.subarray(4, 8).toString() === "ftyp";
    const mp3 =
      bytes.subarray(0, 3).toString() === "ID3" ||
      (bytes[0] === 0xff && (bytes[1] & 0xe0) === 0xe0);
    if (!(
      (mime === "audio/webm" && webm) ||
      (mime === "audio/ogg" && ogg) ||
      (mime === "audio/wav" && wav) ||
      (mime === "audio/mp4" && mp4) ||
      (mime === "audio/mpeg" && mp3)
    ))
      throw new DomainError("This recording's format could not be verified.");
  } else
    throw new DomainError(
      "Use a JPEG, PNG, WebP photo or a supported audio recording.",
    );
  const store = getStore();
  store.throttle(`upload:${member.id}`, 40, 3600000);
  const mediaId = store.saveMedia(member, mime, bytes.length);
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", secret("media.key"), iv);
  const encrypted = Buffer.concat([cipher.update(bytes), cipher.final()]);
  try {
    fs.writeFileSync(
      path.join(mediaDirectory(), mediaId),
      Buffer.concat([iv, cipher.getAuthTag(), encrypted]),
      { mode: 0o600, flag: "wx" },
    );
  } catch (error) {
    store.run("DELETE FROM media WHERE id=?", mediaId);
    throw error;
  }
  return { id: mediaId, mime, bytes: bytes.length };
}
export function readMedia(member: Member, mediaId: string, store: FamilyStore = getStore()) {
  const row = store.media(member, mediaId);
  if (row.filename.startsWith("demo:")) {
    if (!store.family(member.family_id).is_demo)
      throw new DomainError("Media not available.", 404);
    const filename = path.basename(row.filename.slice(5));
    return {
      mime: row.mime,
      bytes: fs.readFileSync(
        path.join(process.cwd(), "public", "demo", filename),
      ),
    };
  }
  let bytes: Buffer;
  try { bytes = fs.readFileSync(path.join(mediaDirectory(), row.id)); }
  catch { throw new DomainError("The original photo or recording is missing. Restore the upload before requesting AI processing.", 404); }
  const decipher = createDecipheriv(
    "aes-256-gcm",
    secret("media.key"),
    bytes.subarray(0, 12),
  );
  decipher.setAuthTag(bytes.subarray(12, 28));
  return {
    mime: row.mime,
    bytes: Buffer.concat([
      decipher.update(bytes.subarray(28)),
      decipher.final(),
    ]),
  };
}
export function removeMediaFile(mediaId: string | null) {
  if (mediaId)
    fs.rmSync(path.join(mediaDirectory(), path.basename(mediaId)), {
      force: true,
    });
}
export function cleanOrphanMedia() {
  const store = getStore();
  const unused = store.all<{ id: string }>(
    "SELECT id FROM media WHERE created_at<? AND id NOT IN (SELECT media_id FROM memories WHERE media_id IS NOT NULL) AND id NOT IN (SELECT media_id FROM messages WHERE media_id IS NOT NULL)",
    Date.now() - 86400000,
  );
  for (const row of unused) {
    removeMediaFile(row.id);
    store.run("DELETE FROM media WHERE id=?", row.id);
  }
  // Unknown files may belong to another database or backup. Never delete them.
}
