"use server";

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

export async function saveAvatarUrl(filePath: string) {
    const supabase = await createClient();
    const { data, error: authError } = await supabase.auth.getClaims();
    const userId = data?.claims?.sub;

    if (authError || !userId) {
        return { error: "Please sign in again before uploading a photo." };
    }

    // Derive the URL on the server and only accept this user's upload path.
    if (typeof filePath !== "string" || !filePath.startsWith(`${userId}/`) ||
        !/^[a-f0-9-]+\.(jpg|png|webp|gif)$/.test(filePath.slice(userId.length + 1))) {
        return { error: "Invalid avatar file." };
    }

    const { data: urlData } = supabase.storage.from("avatars").getPublicUrl(filePath);
    const { data: profile, error } = await supabase
        .from("profiles")
        .update({ avatar_url: urlData.publicUrl, updated_at: new Date().toISOString() })
        .eq("id", userId)
        .select("id")
        .single();

    if (error || !profile) {
        return { error: "Your photo was uploaded, but your profile could not be saved. Please try again." };
    }

    revalidatePath("/profile");
    return { avatarUrl: urlData.publicUrl };
}

export async function updateProfile(formData: FormData) {
    const supabase = await createClient();

    const { data } = await supabase.auth.getClaims();
    const userId = data?.claims?.sub;

    if (!userId) {
        redirect("/login");
    }

    const rawFirst = formData.get("first_name");
    const rawLast = formData.get("last_name");
    const firstName = typeof rawFirst === "string" ? rawFirst.trim() : "";
    const lastName = typeof rawLast === "string" ? rawLast.trim() : "";
    if (!firstName || !lastName || firstName.length > 100 || lastName.length > 100) {
        redirect("/profile?error=name");
    }

    const { error } = await supabase
        .from("profiles")
        .update({
            first_name: firstName,
            last_name: lastName,
            updated_at: new Date().toISOString(),
        })
        .eq("id", userId).select("id").single();

    if (error) {
        throw new Error(error.message);
    }

    revalidatePath("/", "layout");
    redirect("/profile?saved=1");
}
