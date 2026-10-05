"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

type VoteResult = { ok: true; vote: 1 | -1; message: string } | { ok: false; error: string };

export async function submitVote(captionId: number, vote: number): Promise<VoteResult> {
    if (!Number.isSafeInteger(captionId) || captionId <= 0 || (vote !== 1 && vote !== -1)) {
        return { ok: false, error: "Choose a valid caption and vote." };
    }
    const supabase = await createClient();
    const { data, error: authError } = await supabase.auth.getUser();
    if (authError || !data.user || data.user.is_anonymous) {
        return { ok: false, error: "Please sign in before voting." };
    }
    // The browser supplies the caption and vote; identity always comes from auth.
    const { error } = await supabase.from("caption_votes").insert({
        caption_id: captionId, user_id: data.user.id, vote,
    });
    if (error?.code === "23505") {
        const { data: existing, error: readError } = await supabase.from("caption_votes")
            .select("vote").eq("caption_id", captionId).eq("user_id", data.user.id).single();
        if (readError || (existing?.vote !== 1 && existing?.vote !== -1)) {
            return { ok: false, error: "You already voted on this caption. Refresh to see your vote." };
        }
        revalidatePath("/");
        revalidatePath("/explore");
        return { ok: true, vote: existing.vote, message: "Your earlier vote is already saved." };
    }
    if (error) {
        return { ok: false, error: error.code === "23503" ? "This caption is no longer available." : "Your vote could not be saved. Please try again." };
    }
    revalidatePath("/");
    revalidatePath("/explore");
    return { ok: true, vote, message: "Vote saved. Thanks for rating!" };
}
