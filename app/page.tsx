import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { hasCompleteName } from "@/lib/profile";
import CaptionPhoto from "./components/caption-photo";
import SiteFrame from "./components/site-frame";
import VoteButtons from "./components/vote-buttons";
import Sticker from "./components/sticker";

export default async function Home() {
    const supabase = await createClient();
    const { data, error: authError } = await supabase.auth.getClaims();
    const userId = data?.claims?.sub;
    if (authError || !userId) redirect("/login");

    const { data: profile, error: profileError } = await supabase.from("profiles")
        .select("first_name, last_name, avatar_url").eq("id", userId).maybeSingle();
    if (profileError) throw new Error("Unable to load your profile. Please try again.");
    if (!hasCompleteName(profile)) redirect("/profile");

    const { data: captions, error } = await supabase.from("captions")
        .select("id, caption, image_url, image_alt, image_source_url, image_credit").order("created_at", { ascending: false }).order("id", { ascending: false });

    const { data: votes, error: votesError } = await supabase.from("caption_votes")
        .select("caption_id, vote").eq("user_id", userId);
    const ownVotes = new Map<number, 1 | -1>();
    for (const row of votes ?? []) {
        if (row.vote === 1 || row.vote === -1) ownVotes.set(row.caption_id, row.vote);
    }

    return <SiteFrame active="captions" profile={profile}>
        <div className="page-intro collection-heading">
            <div><span className="eyebrow">THE LATEST FROM THE CLUB</span><h1>A fresh point of view.</h1><p>Everyday moments. Unexpected captions.</p></div><span className="caption-count">{error ? "" : `${captions?.length ?? 0} captions`}</span>
        </div>
        {error ? <p role="alert" className="collection-notice">We couldn’t load the captions. Please refresh to try again.</p> :
            captions?.length ? <section className="gallery-section" aria-labelledby="gallery-title"><h2 id="gallery-title" className="folder-tab gallery-title">Latest captions <span aria-hidden="true">✧</span></h2><Sticker kind="laugh" className="gallery-sticker" /><div className="gallery-container"><div className="caption-grid" role="region" aria-label="Latest captions gallery — scroll horizontally to browse" tabIndex={0}>{captions.map((caption) =>
                <article className="caption-card" key={caption.id}>
                    <VoteButtons captionId={caption.id} initialVote={ownVotes.get(caption.id) ?? null} unavailable={Boolean(votesError)} />
                    {caption.image_url ? <CaptionPhoto key={caption.image_url} src={caption.image_url} alt={caption.image_alt ?? "Caption photo"} /> : <div className="caption-photo photo-placeholder"><span className="photo-unavailable">Photo unavailable</span></div>}
                    <div className="caption-content">
                    <blockquote>{caption.caption}</blockquote>
                    </div>
                </article>
            )}</div><p className="gallery-hint">Scroll sideways to explore more captions <span aria-hidden="true">→</span></p></div></section> : <p className="collection-notice">No captions yet.</p>}
    </SiteFrame>;
}
