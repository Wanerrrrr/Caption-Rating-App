import "server-only";
import { createHash, createHmac, randomUUID, timingSafeEqual } from "node:crypto";

export type GenerationDraft = {
    id: string; userId: string; expiresAt: number; imageHash: string; mime: string;
    caption: string; description: string; descriptionPrompt: string; prompt: string; model: string;
};

function signature(payload: string) {
    const secret = process.env.GEMINI_API_KEY;
    if (!secret) throw new Error("AI generation is not configured.");
    return createHmac("sha256", secret).update(`caption-club-draft:v1:${payload}`).digest();
}

export function imageHash(bytes: Buffer) { return createHash("sha256").update(bytes).digest("hex"); }

export function signDraft(fields: Omit<GenerationDraft, "id" | "expiresAt">) {
    const draft: GenerationDraft = { ...fields, id: randomUUID(), expiresAt: Date.now() + 30 * 60_000 };
    const payload = Buffer.from(JSON.stringify(draft)).toString("base64url");
    return `${payload}.${signature(payload).toString("base64url")}`;
}

export function verifyDraft(token: string, userId: string, bytes: Buffer, mime: string): GenerationDraft {
    if (token.length > 24_000) throw new Error("Invalid preview. Generate again.");
    const parts = token.split(".");
    if (parts.length !== 2) throw new Error("Invalid preview. Generate again.");
    const [payload, mac] = parts;
    const provided = Buffer.from(mac, "base64url");
    const expected = signature(payload);
    if (provided.length !== expected.length || !timingSafeEqual(provided, expected)) throw new Error("Invalid preview. Generate again.");
    const draft = JSON.parse(Buffer.from(payload, "base64url").toString()) as GenerationDraft;
    if (draft.userId !== userId || draft.imageHash !== imageHash(bytes) || draft.mime !== mime) throw new Error("The image or account changed. Generate again.");
    if (!Number.isFinite(draft.expiresAt) || draft.expiresAt < Date.now()) throw new Error("This preview expired. Generate again.");
    return draft;
}
