import { assertCanEnter, getChallenge, fixedChallengeImage, finishCredit, serverSecret, UUID } from "@/lib/challenge";
import { randomUUID } from "node:crypto";
import { createClient } from "@/lib/supabase/server";
import { captionPrompt, generateWithFallback, aiConfigured, ProviderFailure, type Provider, logGeneration } from "@/lib/gemini";
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
    if (!aiConfigured()) {
        return reject("AI generation is not configured yet. Configure an AI service on the server.", 503, "configuration");
    }
    if (Number(request.headers.get("content-length")) > MAX_BYTES + 32_768) {
        return reject("Choose an image up to 3 MB.", 413, "upload_too_large");
    }
    let form: FormData;
    try { form = await request.formData(); }
    catch { return reject("The upload could not be read.", 400, "unreadable_upload"); }
    const challengeValue = form.get("challengeId");
    const challengeId = typeof challengeValue === "string" && challengeValue ? challengeValue : null;
    if (challengeId && !UUID.test(challengeId)) return reject("Choose a valid challenge.", 400, "invalid_challenge");
    let challenge = null;
    let photo = form.get("photo");
    try {
        if (challengeId) {
            challenge = await getChallenge(supabase, challengeId);
            if (!challenge) return reject("Challenge not found.", 404, "invalid_challenge");
            await assertCanEnter(supabase, challenge, data.user.id);
            if (challenge.image_url) photo = await fixedChallengeImage(challenge);
        }
    } catch (cause) { return reject(cause instanceof Error ? cause.message : "Challenge unavailable.", 400, "challenge_unavailable"); }
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
    let generationId: string;
    try {
        const { data: reserved, error } = await supabase.rpc("reserve_generation", { p_server_secret: serverSecret(), p_challenge_id: challengeId });
        if (error) return reject(error.message, 429, "credits_unavailable");
        generationId = reserved;
    } catch (cause) { return reject(cause instanceof Error ? cause.message : "Generation credits unavailable.", 503, "credits_configuration"); }
    async function acquireCall(provider: Provider) {
        const { error } = await supabase.rpc("acquire_provider_call", { p_provider: provider, p_generation_id: generationId, p_server_secret: serverSecret() });
        if (error) {
            if (/^Daily AI capacity reached|^AI is busy/.test(error.message)) throw new ProviderFailure(error.message, true);
            throw new Error(error.message);
        }
    }
    let stage: "description" | "caption" | "draft" = "description";
    // Preview only: no storage upload or database write until the user publishes.
    try {
        const descriptionResult = await generateWithFallback([
            { text: prepared.descriptionPrompt },
            ...prepared.images,
        ], 2000, { requestId, stage: "description" }, acquireCall, started + 110_000);
        const description = descriptionResult.text;
        const prompt = captionPrompt(description, challenge ? `${challenge.theme}. ${direction}` : direction);
        stage = "caption";
        const captionResult = await generateWithFallback([{ text: prompt }], 240, { requestId, stage: "caption" }, acquireCall, started + 110_000, descriptionResult.provider);
        const caption = captionResult.text;
        stage = "draft";
        const draftStarted = Date.now();
        logGeneration({ requestId, stage }, "started");
        const draft = signDraft({ generationId, challengeId, userId: data.user.id, imageHash: imageHash(bytes), mime: photo.type,
            caption, description, descriptionPrompt: prepared.descriptionPrompt, prompt, model: captionResult.model, descriptionModel: descriptionResult.model });
        const credits = await finishCredit(supabase, generationId, true);
        logGeneration({ requestId, stage }, "success", { elapsedMs: Date.now() - draftStarted });
        logGeneration({ requestId, stage: "request" }, "success", { elapsedMs: Date.now() - started });
        return Response.json({ caption, description, draft, credits }, { headers: { "Cache-Control": "no-store" } });
    } catch (cause) {
        try { await finishCredit(supabase, generationId, false); }
        catch { logGeneration({ requestId, stage: "request" }, "failure", { kind: "credit_refund_pending" }); }
        if (stage === "draft") logGeneration({ requestId, stage }, "failure", { kind: "draft_processing", elapsedMs: Date.now() - started });
        logGeneration({ requestId, stage: "request" }, "failure", { failedStage: stage, elapsedMs: Date.now() - started });
        const message = cause instanceof Error && cause.name !== "TimeoutError" ? cause.message : "Generation took too long. Please try again.";
        return Response.json({ error: message }, { status: 502 });
    }
}
