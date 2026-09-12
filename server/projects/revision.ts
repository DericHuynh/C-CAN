import { createHash } from "node:crypto";
export const projectRevision = (json: string) => createHash("sha256").update(json).digest("hex");
