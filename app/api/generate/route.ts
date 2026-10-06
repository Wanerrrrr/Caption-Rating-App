import { createClient } from "@/lib/supabase/server";
import { captionPrompt, generateText, GEMINI_MODEL } from "@/lib/gemini";
import { imageExtensions, matchesImage, prepareDescriptionImage } from "@/lib/caption-image";
import { imageHash, signDraft } from "@/lib/generation-draft";

export const runtime = "nodejs";
export const maxDuration = 120;
const MAX_BYTES = 3 * 1024 * 1024;

export async function POST(request: Request) {
    if (request.headers.get("origin") !== new URL(request.url).origin) {
        return Response.json({ error: "Please generate from the app." }, { status: 403 });
    }
    const supabase = await createClient();
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user || data.user.is_anonymous) {
        return Response.json({ error: "Please sign in before generating a caption." }, { status: 401 });
    }
    if (!process.env.GEMINI_API_KEY) {
        return Response.json({ error: "AI generation is not configured yet. Add GEMINI_API_KEY on the server." }, { status: 503 });
    }
    if (Number(request.headers.get("content-length")) > MAX_BYTES + 32_768) {
        return Response.json({ error: "Choose an image up to 3 MB." }, { status: 413 });
    }
    let form: FormData;
    try { form = await request.formData(); }
    catch { return Response.json({ error: "The upload could not be read." }, { status: 400 }); }
    const photo = form.get("photo");
    const rawDirection = form.get("direction");
    const direction = typeof rawDirection === "string" ? rawDirection.trim() : "";
    if (!(photo instanceof File) || !imageExtensions[photo.type] || photo.size === 0 || photo.size > MAX_BYTES || direction.length > 300) {
        return Response.json({ error: "Choose a JPG, PNG, WebP, or GIF up to 3 MB and keep your creative direction under 300 characters." }, { status: 400 });
    }
    const bytes = Buffer.from(await photo.arrayBuffer());
    if (!matchesImage(bytes, photo.type)) {
        return Response.json({ error: "The file does not match its image format." }, { status: 400 });
    }
    let prepared: Awaited<ReturnType<typeof prepareDescriptionImage>>;
    try { prepared = await prepareDescriptionImage(bytes, photo.type); }
    catch (cause) {
        return Response.json({ error: cause instanceof Error ? cause.message : "The image could not be read." }, { status: 400 });
    }
    // Preview only: no storage upload or database write until the user publishes.
    try {
        const description = await generateText([
            { text: prepared.descriptionPrompt },
            ...prepared.images,
        ], 2000);
        const prompt = captionPrompt(description, direction);
        const caption = await generateText([{ text: prompt }], 240);
        const draft = signDraft({ userId: data.user.id, imageHash: imageHash(bytes), mime: photo.type,
            caption, description, descriptionPrompt: prepared.descriptionPrompt, prompt, model: GEMINI_MODEL });
        return Response.json({ caption, description, draft }, { headers: { "Cache-Control": "no-store" } });
    } catch (cause) {
        const message = cause instanceof Error && cause.name !== "TimeoutError" ? cause.message : "Generation took too long. Please try again.";
        return Response.json({ error: message }, { status: 502 });
    }
}
