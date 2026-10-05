import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { captionPrompt, generateText, GEMINI_MODEL } from "@/lib/gemini";
import { imageExtensions, matchesImage, prepareDescriptionImage } from "@/lib/caption-image";

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
    // Generate before uploading: failed AI requests do not leave stored images behind.
    try {
        const description = await generateText([
            { text: prepared.descriptionPrompt },
            ...prepared.images,
        ], 2000);
        const prompt = captionPrompt(description, direction);
        const caption = await generateText([{ text: prompt }], 240);
        const path = `${data.user.id}/${crypto.randomUUID()}.${imageExtensions[photo.type]}`;
        const { error: uploadError } = await supabase.storage.from("caption-images").upload(path, bytes, { contentType: photo.type });
        if (uploadError) return Response.json({ error: "Your caption was generated, but the photo could not be saved. Please try again." }, { status: 500 });
        const { data: image } = supabase.storage.from("caption-images").getPublicUrl(path);
        const { error: saveError } = await supabase.from("captions").insert({
            caption, image_url: image.publicUrl, image_alt: description,
            image_description: description, description_prompt: prepared.descriptionPrompt,
            prompt, generation_model: GEMINI_MODEL, created_by: data.user.id,
        });
        if (saveError) {
            const { error: cleanupError } = await supabase.storage.from("caption-images").remove([path]);
            if (cleanupError) console.error("Unable to clean up an unsaved caption image.");
            return Response.json({ error: "The caption could not be saved. Please try again." }, { status: 500 });
        }
        revalidatePath("/");
        revalidatePath("/explore");
        return Response.json({ caption, description }, { status: 201 });
    } catch (cause) {
        const message = cause instanceof Error && cause.name !== "TimeoutError" ? cause.message : "Generation took too long. Please try again.";
        return Response.json({ error: message }, { status: 502 });
    }
}
