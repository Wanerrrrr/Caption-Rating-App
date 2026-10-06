import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { imageExtensions, matchesImage } from "@/lib/caption-image";
import { verifyDraft } from "@/lib/generation-draft";

export const runtime = "nodejs";
const MAX_BYTES = 3 * 1024 * 1024;

export async function POST(request: Request) {
    if (request.headers.get("origin") !== new URL(request.url).origin) return Response.json({ error: "Please publish from the app." }, { status: 403 });
    const supabase = await createClient();
    const { data, error: authError } = await supabase.auth.getUser();
    if (authError || !data.user || data.user.is_anonymous) return Response.json({ error: "Please sign in before publishing." }, { status: 401 });
    if (Number(request.headers.get("content-length")) > MAX_BYTES + 32_768) return Response.json({ error: "Choose an image up to 3 MB." }, { status: 413 });
    let form: FormData;
    try { form = await request.formData(); }
    catch { return Response.json({ error: "The upload could not be read." }, { status: 400 }); }
    const photo = form.get("photo"), token = form.get("draft");
    if (!(photo instanceof File) || !imageExtensions[photo.type] || !photo.size || photo.size > MAX_BYTES || typeof token !== "string") return Response.json({ error: "Generate a preview before publishing." }, { status: 400 });
    const bytes = Buffer.from(await photo.arrayBuffer());
    if (!matchesImage(bytes, photo.type)) return Response.json({ error: "Invalid image format." }, { status: 400 });
    let draft;
    try { draft = verifyDraft(token, data.user.id, bytes, photo.type); }
    catch (cause) { return Response.json({ error: cause instanceof Error ? cause.message : "Invalid preview. Generate again." }, { status: 400 }); }
    const path = `${data.user.id}/${draft.id}.${imageExtensions[photo.type]}`;
    const { data: image } = supabase.storage.from("caption-images").getPublicUrl(path);
    const alreadyPublished = async () => {
        const { data: existing, error } = await supabase.from("captions").select("id")
            .eq("image_url", image.publicUrl).eq("created_by", data.user.id).limit(1).maybeSingle();
        return { existing, error };
    };
    const success = () => {
        revalidatePath("/"); revalidatePath("/explore");
        return Response.json({ published: true });
    };
    // A stable draft path and non-overwriting upload prevent duplicate publishes.
    const previous = await alreadyPublished();
    if (previous.error) return Response.json({ error: "Could not check publishing status. Please retry." }, { status: 500 });
    if (previous.existing) return success();
    const { error: uploadError } = await supabase.storage.from("caption-images").upload(path, bytes, { contentType: photo.type, upsert: false });
    if (uploadError) {
        const check = await alreadyPublished();
        if (check.existing) return success();
        return Response.json({ error: "Your image could not be saved, or publishing is still in progress. Please retry." }, { status: 409 });
    }
    const { error: saveError } = await supabase.from("captions").insert({
        caption: draft.caption, image_url: image.publicUrl, image_alt: draft.description,
        image_description: draft.description, description_prompt: draft.descriptionPrompt,
        prompt: draft.prompt, generation_model: draft.model, created_by: data.user.id,
    });
    if (saveError) {
        const check = await alreadyPublished();
        if (check.existing) return success();
        if (!check.error) await supabase.storage.from("caption-images").remove([path]);
        return Response.json({ error: "The caption could not be confirmed as published. Please retry." }, { status: 500 });
    }
    return success();
}
