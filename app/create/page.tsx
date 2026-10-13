import { getCredits, getChallenge, assertCanEnter } from "@/lib/challenge";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { hasCompleteProfile } from "@/lib/profile";
import SiteFrame from "../components/site-frame";
import GenerateForm from "./generate-form";

export default async function CreatePage({ searchParams }: { searchParams: Promise<{ challenge?: string }> }) {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user || data.user.is_anonymous) redirect("/login");
    const { data: profile, error: profileError } = await supabase.from("profiles").select("first_name, last_name, avatar_url, nickname").eq("id", data.user.id).maybeSingle();
    if (profileError) throw new Error("Unable to load your profile. Please try again.");
    if (!hasCompleteProfile(profile)) redirect("/profile");
    const credits = await getCredits(supabase);
    const { challenge: challengeId } = await searchParams;
    const challenge = challengeId ? await getChallenge(supabase, challengeId) : null;
    let challengeError = "";
    if (challengeId) {
        if (!challenge) challengeError = "Challenge not found.";
        else try { await assertCanEnter(supabase, challenge, data.user.id); } catch (cause) { challengeError = cause instanceof Error ? cause.message : "Challenge unavailable."; }
    }
    return <SiteFrame active="create" profile={profile}>
        <div className="page-intro"><h1>{challenge ? "Enter the challenge" : "Make a caption"}</h1><p>{challenge ? `${challenge.title} · ${challenge.theme}` : "Upload an image and let AI turn it into a caption."}</p></div>
        {challengeError ? <p role="alert">{challengeError}</p> : <GenerateForm configured={Boolean((process.env.GEMINI_API_KEY || process.env.GROQ_API_KEY) && process.env.CHALLENGE_SERVER_SECRET)} initialCredits={credits} challenge={challenge} />}
    </SiteFrame>;
}
