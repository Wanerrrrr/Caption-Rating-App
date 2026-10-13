import { withPostAuthors } from "@/lib/post-authors";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { hasCompleteProfile } from "@/lib/profile";
import type { ExploreCaption } from "@/lib/explore";
import SiteFrame from "../components/site-frame";
import ExploreGallery from "./explore-gallery";

export default async function Explore({ searchParams }: {
    searchParams: Promise<{ q?: string | string[]; liked?: string }>;
}) {
    const { q, liked } = await searchParams;
    const searchQuery = (typeof q === "string" ? q : q?.[0] ?? "").slice(0, 200).trim().replace(/\s+/g, " ");
    const supabase = await createClient();
    const { data } = await supabase.auth.getUser();
    const userId = data.user && !data.user.is_anonymous ? data.user.id : null;
    const { data: profile, error: profileError } = userId ? await supabase.from("profiles")
        .select("first_name, last_name, avatar_url, nickname").eq("id", userId).maybeSingle() : { data: null, error: null };
    if (profileError) throw new Error("Unable to load your profile. Please try again.");
    if (userId && !hasCompleteProfile(profile)) redirect("/profile");

    // Page through the API limit so every caption participates in filtering and sorting.
    const captions: ExploreCaption[] = [];
    let loadFailed = false;
    for (let start = 0; ; start += 500) {
        const { data: rows, error } = await supabase.from("captions")
            .select("id, caption, image_url, image_alt, image_description, created_at, created_by, like_count, challenge_id")
            .order("created_at", { ascending: false }).order("id", { ascending: false }).range(start, start + 499);
        if (error) { loadFailed = true; break; }
        captions.push(...(rows ?? []).map(row => ({ ...row, like_count: Number(row.like_count), ownVote: null })));
        if (!rows || rows.length < 500) break;
    }
    let votesFailed = false;
    const ownVotes = new Map<number, 1 | -1>();
    if (userId) for (let start = 0; ; start += 500) {
        const { data: votes, error } = await supabase.from("caption_votes")
            .select("id, caption_id, vote").eq("user_id", userId).order("id").range(start, start + 499);
        if (error) { votesFailed = true; break; }
        for (const vote of votes ?? []) if (vote.vote === 1 || vote.vote === -1) ownVotes.set(vote.caption_id, vote.vote);
        if (!votes || votes.length < 500) break;
    }
    const { data: closedRounds } = await supabase.from("weekly_challenges").select("id").lte("ends_at", new Date().toISOString());
    const closedIds = new Set((closedRounds ?? []).map(round => round.id));
    const posts = await withPostAuthors(supabase, captions);
    return <SiteFrame guest={!userId} active="explore" profile={profile} searchQuery={searchQuery}>
        {loadFailed ? <p role="alert" className="collection-notice">We couldn’t load the captions. Please refresh to try again.</p> :
            <ExploreGallery guest={!userId} initialLikedOnly={Boolean(userId && liked === "1")} key={`${searchQuery}:${liked ?? ""}`} searchQuery={searchQuery} captions={posts.map(caption => ({ ...caption, ownVote: ownVotes.get(caption.id) ?? null, votingClosed: Boolean(caption.challenge_id && closedIds.has(caption.challenge_id)) }))} votesUnavailable={votesFailed} />}
    </SiteFrame>;
}
