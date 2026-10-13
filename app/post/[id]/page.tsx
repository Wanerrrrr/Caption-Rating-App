import { challengeTime } from "@/lib/challenge";
import PostMeta from "../../components/post-meta";
import { withPostAuthors } from "@/lib/post-authors";
import { notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import SiteFrame from "../../components/site-frame";
import CaptionPhoto from "../../components/caption-photo";
import VoteButtons from "../../components/vote-buttons";
import ShareCaption from "../../components/share-caption";

export default async function Post({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    if (!/^\d+$/.test(id) || !Number.isSafeInteger(Number(id)) || Number(id) <= 0) notFound();
    const supabase = await createClient();
    const { data: caption, error } = await supabase.from("captions").select("id,caption,image_url,image_alt,created_at,created_by,like_count,challenge_id").eq("id", Number(id)).maybeSingle();
    if (error) throw new Error("Could not load this caption. Please refresh.");
    if (!caption) notFound();
    const { data } = await supabase.auth.getUser();
    const user = data.user && !data.user.is_anonymous ? data.user : null;
    const { data: profile } = user ? await supabase.from("profiles").select("first_name,last_name,avatar_url").eq("id", user.id).maybeSingle() : { data: null };
    const { data: vote } = user ? await supabase.from("caption_votes").select("vote").eq("caption_id", caption.id).eq("user_id", user.id).maybeSingle() : { data: null };
    const { data: challenge } = caption.challenge_id ? await supabase.from("weekly_challenges").select("ends_at,settled_at").eq("id", caption.challenge_id).maybeSingle() : { data: null };
    const votingClosed = Boolean(challenge && (challenge.settled_at || new Date(challenge.ends_at).getTime() <= challengeTime()));
    const [post] = await withPostAuthors(supabase, [caption]);
    return <SiteFrame active={user ? "post" : "login"} profile={profile}>
        <div className="post-view"><h1 className="liked-title">Caption Club post</h1><article className="caption-card post-card">
            {user && <VoteButtons captionId={caption.id} initialVote={vote?.vote ?? null} likeCount={Number(caption.like_count)} votingClosed={votingClosed} />}
            {caption.image_url && <CaptionPhoto src={caption.image_url} alt={caption.image_alt ?? "Caption photo"} />}
            <div className="caption-content"><blockquote>{caption.caption}</blockquote><PostMeta author={post.author} createdAt={caption.created_at} /></div>
            <ShareCaption id={caption.id} caption={caption.caption} hasImage={Boolean(caption.image_url)} />
        </article>{!user && <Link className="pill-button" href="/login">Sign in to like captions ↗</Link>}</div>
    </SiteFrame>;
}
