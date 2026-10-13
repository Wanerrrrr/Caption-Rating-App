import PrizeMedal from "./components/prize-medal";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { challengeTime, type Challenge } from "@/lib/challenge";
import { hasCompleteProfile } from "@/lib/profile";
import { withPostAuthors } from "@/lib/post-authors";
import SiteFrame from "./components/site-frame";
import CaptionPhoto from "./components/caption-photo";
import ExploreGallery from "./explore/explore-gallery";

export default async function Home({ searchParams }: { searchParams: Promise<{ round?: string }> }) {
    const client = await createClient();
    const { data: auth } = await client.auth.getUser();
    if (!auth.user || auth.user.is_anonymous) redirect("/login");
    const userId = auth.user.id;
    const { data: profile, error: profileError } = await client.from("profiles").select("first_name,last_name,avatar_url,nickname").eq("id",userId).maybeSingle();
    if (profileError) throw new Error("Unable to load your profile.");
    if (!hasCompleteProfile(profile)) redirect("/profile");
    // Deadline snapshots and rewards are transactionally settled once, on the
    // first authenticated visit after closing. No paid scheduler is required.
    const { error: settlementError } = await client.rpc("settle_weekly_challenges");
    const { data: rounds, error: roundError } = await client.from("weekly_challenges").select("*").order("week_start",{ascending:false});
    if (roundError) throw new Error("Unable to load weekly challenges.");
    const now = challengeTime(); const allRounds = (rounds ?? []) as Challenge[];
    const active = allRounds.find(round=>Date.parse(round.starts_at)<=now && Date.parse(round.ends_at)>now);
    const { round } = await searchParams;
    const challenge = (round ? allRounds.find(item=>item.id===round && Date.parse(item.starts_at)<=now) : active) ?? null;
    const { data: entries, error: entriesError } = challenge ? await client.from("challenge_entries").select("*").eq("challenge_id",challenge.id) : {data:[],error:null};
    const ids = (entries ?? []).map(entry=>entry.caption_id);
    const { data: captions, error: captionsError } = ids.length ? await client.from("captions").select("id,caption,image_url,image_alt,image_description,created_at,created_by,like_count,challenge_id").in("id",ids) : {data:[],error:null};
    const { data: votes, error: votesError } = ids.length ? await client.from("caption_votes").select("caption_id,vote").eq("user_id",userId).in("caption_id",ids) : {data:[],error:null};
    const ownVotes = new Map((votes ?? []).map(vote=>[vote.caption_id,vote.vote]));
    const entryMap = new Map((entries ?? []).map(entry=>[entry.caption_id,entry]));
    const closed = Boolean(challenge && Date.parse(challenge.ends_at)<=now);
    const posts = await withPostAuthors(client,(captions ?? []).map(caption=>{
        const entry=entryMap.get(caption.id)!;
        return {...caption, like_count:Number(closed && entry.final_likes !== null ? entry.final_likes : caption.like_count), ownVote:ownVotes.get(caption.id) as 1|-1|undefined ?? null, rank:entry.rank as number|null, reward:entry.reward as number|null, votingClosed:closed};
    }).sort((a,b)=>b.like_count-a.like_count || Date.parse(entryMap.get(a.id)!.submitted_at)-Date.parse(entryMap.get(b.id)!.submitted_at) || a.id-b.id));
    const entered = entries?.some(entry=>entry.user_id===userId);
    const past = allRounds.filter(item=>Date.parse(item.ends_at)<=now);
    return <SiteFrame active="captions" profile={profile}>
        <div className="challenge-content">
            <div className="challenge-heading"><div><h1 className="eyebrow">THE WEEKLY CLUB CHALLENGE</h1><p className="challenge-intro">Create a caption for this week’s theme. Collect likes and win extra generation credit.</p></div></div>
            <section className="challenge-hero details-card">
                {challenge ? <>
                    <div className="challenge-status">{closed ? "Challenge ended" : "This week"}<span>{entries?.length ?? 0} entries</span></div>
                    <h2>{challenge.title}</h2><p>{challenge.theme}</p>
                    {challenge.image_url && <div className="challenge-image"><CaptionPhoto src={challenge.image_url} alt="This week's challenge image" /></div>}
                    <div className="challenge-deadline">{closed ? "Closed" : "Closes"} {new Intl.DateTimeFormat('en-US',{timeZone:'America/New_York',month:'short',day:'numeric',hour:'numeric',minute:'2-digit'}).format(new Date(challenge.ends_at))} · New York</div>
                    {!closed && (entered ? <p className="entry-confirmed">✓ You’re in! Share your post and collect likes.</p> : <Link className="pill-button" href={`/create?challenge=${challenge.id}`}>Enter this week ↗</Link>)}
                </> : <><h2>The next challenge is on its way.</h2><p>Explore captions while the club prepares this week’s theme.</p><Link className="pill-button" href="/explore">Explore captions ↗</Link></>}
            </section>
            <div className="challenge-prizes"><div><PrizeMedal place={1}/><div className="prize-copy"><strong>1 winner</strong><span>+3 credits</span></div></div><div><PrizeMedal place={2}/><div className="prize-copy"><strong>3 winners</strong><span>+2 credits each</span></div></div><div><PrizeMedal place={3}/><div className="prize-copy"><strong>10 winners</strong><span>+1 credit each</span></div></div></div>
            <div className="challenge-rounds"><Link href="/" aria-current={!round?'page':undefined}>This week</Link>{past.map(item=><Link key={item.id} href={`/?round=${item.id}`} aria-current={challenge?.id===item.id?'page':undefined}>{item.title}</Link>)}</div>
            {settlementError && <p role="alert">Results are still being settled. Please refresh.</p>}
            {entriesError || captionsError ? <p role="alert">Entries could not be loaded. Please refresh.</p> : challenge && <ExploreGallery captions={posts} votesUnavailable={Boolean(votesError)} contest />}
        </div>
    </SiteFrame>;
}
