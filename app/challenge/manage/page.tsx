import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import SiteFrame from "@/app/components/site-frame";
import { createChallenge } from "./actions";

export default async function Manage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
    const client = await createClient();
    const { data: auth } = await client.auth.getUser();
    if (!auth.user) redirect("/login");
    const { data: admin } = await client.rpc("is_challenge_admin");
    if (!admin) redirect("/");
    const { data: profile } = await client.from("profiles").select("first_name,last_name,avatar_url,nickname").eq("id", auth.user.id).single();
    const { data: challenges } = await client.from("weekly_challenges").select("id,title,week_start").order("week_start", { ascending: false }).limit(12);
    const { error } = await searchParams;
    const errors: Record<string,string> = { duplicate: "A challenge already exists for that week.", image: "Choose a JPG, PNG, WebP or GIF up to 3 MB.", upload: "Image upload failed. Please try again.", invalid: "Add a title and theme, and choose the Monday of a current or future week." };
    return <SiteFrame active="captions" profile={profile}>
        <div className="page-intro"><h1>Host a challenge</h1><p>One theme. One week. A little friendly competition.</p></div>
        <form action={createChallenge} className="details-card profile-form">
            {error && <p role="alert">{errors[error] ?? "Please try again."}</p>}
            <label>Title<input name="title" required maxLength={80} placeholder="NYC Moments" /></label>
            <label>Theme<textarea name="theme" required maxLength={300} rows={3} placeholder="Find the funny side of New York City." /></label>
            <label>Week starts (Monday, New York time)<input name="week" type="date" required /></label>
            <label>Same image for everyone (optional)<input type="file" name="photo" accept="image/jpeg,image/png,image/webp,image/gif" /></label>
            <p className="nickname-help">Leave the image empty to let people upload their own. Ends the following Monday at 12:00 AM. Published challenges cannot be edited.</p>
            <button className="pill-button" type="submit">Publish challenge ↗</button>
        </form>
        <div className="details-card challenge-history"><h2>Scheduled challenges</h2>{challenges?.map(challenge=><p key={challenge.id}>{challenge.week_start} · {challenge.title}</p>)}<Link href="/?view=challenge">Back to weekly challenge ↗</Link></div>
    </SiteFrame>;
}
