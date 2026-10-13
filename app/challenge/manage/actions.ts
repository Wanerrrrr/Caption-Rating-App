"use server";
import { randomUUID } from "node:crypto";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { imageExtensions, matchesImage } from "@/lib/caption-image";

export async function createChallenge(form: FormData) {
    const client = await createClient();
    const { data: auth } = await client.auth.getUser();
    const { data: admin, error: adminError } = await client.rpc("is_challenge_admin");
    if (!auth.user || auth.user.is_anonymous || adminError || !admin) redirect("/");
    const title = String(form.get("title") ?? "").trim();
    const theme = String(form.get("theme") ?? "").trim();
    const week = String(form.get("week") ?? "");
    if (!title || title.length > 80 || !theme || theme.length > 300 || !/^\d{4}-\d{2}-\d{2}$/.test(week)) redirect("/challenge/manage?error=invalid");
    const file = form.get("photo"); let imageUrl: string | null = null; let imagePath: string | null = null;
    if (file instanceof File && file.size) {
        if (!imageExtensions[file.type] || file.size > 3 * 1024 * 1024) redirect("/challenge/manage?error=image");
        const bytes = Buffer.from(await file.arrayBuffer());
        if (!matchesImage(bytes, file.type)) redirect("/challenge/manage?error=image");
        imagePath = `${auth.user.id}/challenge-${randomUUID()}.${imageExtensions[file.type]}`;
        const { error } = await client.storage.from("caption-images").upload(imagePath, bytes, { contentType: file.type, upsert: false });
        if (error) redirect("/challenge/manage?error=upload");
        imageUrl = client.storage.from("caption-images").getPublicUrl(imagePath).data.publicUrl;
    }
    const { error } = await client.rpc("create_weekly_challenge", { p_title: title, p_theme: theme, p_week: week, p_image_url: imageUrl });
    if (error) {
        if (imagePath) await client.storage.from("caption-images").remove([imagePath]);
        redirect(`/challenge/manage?error=${error.code === '23505' ? 'duplicate' : 'invalid'}`);
    }
    revalidatePath("/"); revalidatePath("/challenge/manage");
    redirect("/?challengeCreated=1");
}
