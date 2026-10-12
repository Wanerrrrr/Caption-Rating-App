import { withPostAuthors } from "@/lib/post-authors";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { hasCompleteProfile } from "@/lib/profile";
import type { ExploreCaption } from "@/lib/explore";
import SiteFrame from "../components/site-frame";
import ExploreGallery from "../explore/explore-gallery";

export default async function Liked() {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user || data.user.is_anonymous) redirect("/login");
    const { data: profile, error: profileError } = await supabase.from("profiles").select("first_name,last_name,avatar_url,nickname").eq("id", data.user.id).maybeSingle();
    if (profileError) throw new Error("Could not load your profile.");
    if (!hasCompleteProfile(profile)) redirect("/profile");
    const captions: ExploreCaption[] = [];
    let failed = false;
    // Read every positive vote, newest liked first, without the API's default row cap.
    for (let start = 0; ; start += 500) {
        const { data: votes, error } = await supabase.from("caption_votes").select("caption_id,id,created_at")
            .eq("user_id", data.user.id).eq("vote", 1).order("created_at", { ascending: false }).order("id", { ascending: false }).range(start, start + 499);
        if (error) { failed = true; break; }
        if (!votes?.length) break;
        const { data: rows, error: captionError } = await supabase.from("captions")
            .select("id,caption,image_url,image_alt,image_description,created_at,created_by,like_count").in("id", votes.map(v => v.caption_id));
        if (captionError) { failed = true; break; }
        const byId = new Map((rows ?? []).map(row => [row.id, row]));
        for (const vote of votes) {
            const row = byId.get(vote.caption_id);
            if (row) captions.push({ ...row, like_count: Number(row.like_count), ownVote: 1 });
        }
        if (votes.length < 500) break;
    }
    const posts = await withPostAuthors(supabase, captions);
    return <SiteFrame active="liked" profile={profile}>{failed ? <p role="alert">Couldn’t load your likes. Please refresh.</p> : <ExploreGallery captions={posts} votesUnavailable={false} liked />}</SiteFrame>;
}
