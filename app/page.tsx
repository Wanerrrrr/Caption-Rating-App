import ChallengePanel from "./components/challenge-panel";
import GenerateForm from "./create/generate-form";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { challengeTime, getCredits, type Challenge, type Credits } from "@/lib/challenge";
import { hasCompleteProfile } from "@/lib/profile";
import { withPostAuthors } from "@/lib/post-authors";
import SiteFrame from "./components/site-frame";
import ExploreGallery from "./explore/explore-gallery";

export default async function Home({ searchParams }: { searchParams: Promise<{ round?: string; view?: string }> }) {
    const client = await createClient();
    const { data: auth } = await client.auth.getUser();
    const userId = auth.user && !auth.user.is_anonymous ? auth.user.id : null;
    const { round, view } = await searchParams;
    if (!userId && !round && view !== "challenge") redirect("/explore");
    const { data: profile, error: profileError } = userId ? await client.from("profiles").select("first_name,last_name,avatar_url,nickname").eq("id",userId).maybeSingle() : { data: null, error: null };
    if (profileError) throw new Error("Unable to load your profile.");
    if (userId && !hasCompleteProfile(profile)) redirect("/profile");
    // Deadline snapshots and rewards are transactionally settled once, on the
    // first authenticated visit after closing. No paid scheduler is required.
    const { error: settlementError } = userId ? await client.rpc("settle_weekly_challenges") : { error: null };
    const { data: rounds, error: roundError } = await client.from("weekly_challenges").select("*").order("week_start",{ascending:false});
    if (roundError) throw new Error("Unable to load weekly challenges.");
    const now = challengeTime(); const allRounds = (rounds ?? []) as Challenge[];
    const active = allRounds.find(round=>Date.parse(round.starts_at)<=now && Date.parse(round.ends_at)>now);
    const challenge = (round ? allRounds.find(item=>item.id===round && Date.parse(item.starts_at)<=now) : active) ?? null;
    const { data: entries, error: entriesError } = challenge ? await client.from("challenge_entries").select("*").eq("challenge_id",challenge.id) : {data:[],error:null};
    const closed = Boolean(challenge && (Date.parse(challenge.ends_at)<=now || challenge.settled_at));
    const entered = Boolean(userId && entries?.some(entry=>entry.user_id===userId));
    const canViewEntries = closed || entered;
    const ids = canViewEntries ? (entries ?? []).map(entry=>entry.caption_id) : [];
    let credits: Credits|null = null;
    let generationError = "";
    if (userId && challenge && !closed && !entered && !entriesError) {
        try { credits = await getCredits(client); }
        catch { generationError = "Unable to load generation credits. Please refresh."; }
    }
    const { data: captions, error: captionsError } = ids.length ? await client.from("captions").select("id,caption,image_url,image_alt,image_description,created_at,created_by,like_count,challenge_id").in("id",ids) : {data:[],error:null};
    const { data: votes, error: votesError } = userId && ids.length ? await client.from("caption_votes").select("caption_id,vote").eq("user_id",userId).in("caption_id",ids) : {data:[],error:null};
    const ownVotes = new Map((votes ?? []).map(vote=>[vote.caption_id,vote.vote]));
    const entryMap = new Map((entries ?? []).map(entry=>[entry.caption_id,entry]));
    const posts = await withPostAuthors(client,(captions ?? []).map(caption=>{
        const entry=entryMap.get(caption.id)!;
        return {...caption, like_count:Number(closed && entry.final_likes !== null ? entry.final_likes : caption.like_count), ownVote:ownVotes.get(caption.id) as 1|-1|undefined ?? null, rank:entry.rank as number|null, reward:entry.reward as number|null, votingClosed:closed};
    }).sort((a,b)=>b.like_count-a.like_count || Date.parse(entryMap.get(a.id)!.submitted_at)-Date.parse(entryMap.get(b.id)!.submitted_at) || a.id-b.id));
    const past = allRounds.filter(item=>Date.parse(item.ends_at)<=now);
    return <SiteFrame guest={!userId} active="captions" profile={profile}>
        <div className="challenge-content">
            <ChallengePanel challenge={challenge} closed={closed}/>
            {challenge&&!closed&&<section className="challenge-generation" aria-label="Create your challenge entry">
                {entered?<p className="challenge-entry-notice">You’re in! Your caption has been submitted for this week.</p>:<>
                    <h2>Create your challenge entry</h2>
                    {!userId?<p className="challenge-entry-notice">Sign in to create a caption and enter this week’s challenge. <Link href="/login">Sign in ↗</Link></p>
                        :generationError?<p role="alert">{generationError}</p>
                        :credits&&<GenerateForm configured={Boolean((process.env.GEMINI_API_KEY||process.env.GROQ_API_KEY)&&process.env.CHALLENGE_SERVER_SECRET)} initialCredits={credits} challenge={challenge}/>}
                    <p className="challenge-entry-hint">Publish your entry to see this week’s submissions.</p>
                </>}
            </section>}
            <div className="challenge-rounds"><Link href={userId ? "/" : "/?view=challenge"} aria-current={!round?'page':undefined}>This week</Link>{past.map(item=><Link key={item.id} href={`/?round=${item.id}`} aria-current={challenge?.id===item.id?'page':undefined}>{item.title}</Link>)}</div>
            {settlementError && <p role="alert">Results are still being settled. Please refresh.</p>}
            {entriesError || captionsError ? <p role="alert">Entries could not be loaded. Please refresh.</p> : challenge && canViewEntries && <section id="challenge-entries" className="challenge-submissions">
                <h2 className="challenge-entries-heading">{closed?"Challenge results":"This week’s submissions"}</h2>
                <ExploreGallery guest={!userId} captions={posts} votesUnavailable={Boolean(votesError)} contest />
            </section>}
        </div>
    </SiteFrame>;
}
