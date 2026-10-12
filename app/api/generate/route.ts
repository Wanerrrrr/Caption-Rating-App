import { randomUUID } from "node:crypto";
import { createClient } from "@/lib/supabase/server";
import { captionPrompt, generateText, GEMINI_MODEL, logGeneration } from "@/lib/gemini";
import { imageExtensions, matchesImage, prepareDescriptionImage } from "@/lib/caption-image";
import { imageHash, signDraft } from "@/lib/generation-draft";

export const runtime = "nodejs";
export const maxDuration = 120;
const MAX_BYTES = 3 * 1024 * 1024;

export async function POST(request: Request) {
    const requestId = randomUUID();
    const started = Date.now();
    logGeneration({ requestId, stage: "request" }, "started");
    function reject(message: string, status: number, kind: string) {
        logGeneration({ requestId, stage: "request" }, "failure", { kind, httpStatus: status, elapsedMs: Date.now() - started });
        return Response.json({ error: message }, { status });
    }
    if (request.headers.get("origin") !== new URL(request.url).origin) {
        return reject("Please generate from the app.", 403, "origin_rejected");
    }
    const supabase = await createClient();
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user || data.user.is_anonymous) {
        return reject("Please sign in before generating a caption.", 401, "authentication_required");
    }
    if (!process.env.GEMINI_API_KEY) {
        return reject("AI generation is not configured yet. Add GEMINI_API_KEY on the server.", 503, "configuration");
    }
    if (Number(request.headers.get("content-length")) > MAX_BYTES + 32_768) {
        return reject("Choose an image up to 3 MB.", 413, "upload_too_large");
    }
    let form: FormData;
    try { form = await request.formData(); }
    catch { return reject("The upload could not be read.", 400, "unreadable_upload"); }
    const photo = form.get("photo");
    const rawDirection = form.get("direction");
    const direction = typeof rawDirection === "string" ? rawDirection.trim() : "";
    if (!(photo instanceof File) || !imageExtensions[photo.type] || photo.size === 0 || photo.size > MAX_BYTES || direction.length > 300) {
        return reject("Choose a JPG, PNG, WebP, or GIF up to 3 MB and keep your creative direction under 300 characters.", 400, "invalid_input");
    }
    const bytes = Buffer.from(await photo.arrayBuffer());
    if (!matchesImage(bytes, photo.type)) {
        return reject("The file does not match its image format.", 400, "invalid_image_format");
    }
    let prepared: Awaited<ReturnType<typeof prepareDescriptionImage>>;
    const imageStarted = Date.now();
    logGeneration({ requestId, stage: "image_processing" }, "started");
    try {
        prepared = await prepareDescriptionImage(bytes, photo.type);
        logGeneration({ requestId, stage: "image_processing" }, "success", { elapsedMs: Date.now() - imageStarted });
    }
    catch (cause) {
        logGeneration({ requestId, stage: "image_processing" }, "failure", { kind: "invalid_image", elapsedMs: Date.now() - imageStarted });
        return reject(cause instanceof Error ? cause.message : "The image could not be read.", 400, "image_processing");
    }
    let stage: "description" | "caption" | "draft" = "description";
    // Preview only: no storage upload or database write until the user publishes.
    try {
        const description = await generateText([
            { text: prepared.descriptionPrompt },
            ...prepared.images,
        ], 2000, { requestId, stage: "description" });
        const prompt = captionPrompt(description, direction);
        stage = "caption";
        const caption = await generateText([{ text: prompt }], 240, { requestId, stage: "caption" });
        stage = "draft";
        const draftStarted = Date.now();
        logGeneration({ requestId, stage }, "started");
        const draft = signDraft({ userId: data.user.id, imageHash: imageHash(bytes), mime: photo.type,
            caption, description, descriptionPrompt: prepared.descriptionPrompt, prompt, model: GEMINI_MODEL });
        logGeneration({ requestId, stage }, "success", { elapsedMs: Date.now() - draftStarted });
        logGeneration({ requestId, stage: "request" }, "success", { elapsedMs: Date.now() - started });
        return Response.json({ caption, description, draft }, { headers: { "Cache-Control": "no-store" } });
    } catch (cause) {
        if (stage === "draft") logGeneration({ requestId, stage }, "failure", { kind: "draft_processing", elapsedMs: Date.now() - started });
        logGeneration({ requestId, stage: "request" }, "failure", { failedStage: stage, elapsedMs: Date.now() - started });
        const message = cause instanceof Error && cause.name !== "TimeoutError" ? cause.message : "Generation took too long. Please try again.";
        return Response.json({ error: message }, { status: 502 });
    }
}
