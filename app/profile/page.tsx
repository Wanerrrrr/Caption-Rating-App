import Link from "next/link";
import { hasCompleteProfile } from "@/lib/profile";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { updateProfile } from "./actions";
import AvatarUpload from "./avatar-upload";
import SiteFrame from "../components/site-frame";
import SaveButton from "./save-button";

export default async function ProfilePage({ searchParams }: { searchParams: Promise<{ error?: string; saved?: string }> }) {
    const params = await searchParams;
    const supabase = await createClient();

    const { data } = await supabase.auth.getClaims();
    const userId = data?.claims?.sub;

    if (!userId) {
        redirect("/login");
    }

    const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("first_name, last_name, avatar_url, nickname")
        .eq("id", userId)
        .maybeSingle();

    if (profileError) throw new Error("Unable to load your profile. Please try again.");
    const incomplete = !hasCompleteProfile(profile);

    return (
        <SiteFrame active="profile" profile={profile}>
            <div className="page-intro">
                <h1>Profile</h1>
                {incomplete && <p>Choose a nickname and complete your profile.</p>}
            </div>
            {params.error === "name" && <p role="alert" className="collection-notice">Please enter both names, using 1–100 characters each.</p>}
            {params.error === "nickname" && <p role="alert" className="collection-notice">Choose a nickname using 1–40 characters.</p>}
            {params.saved === "1" && <p role="status" className="collection-notice">Profile saved. <Link href="/">Continue to captions ↗</Link></p>}
            <div className="profile-grid">
                <AvatarUpload userId={userId} currentAvatarUrl={profile?.avatar_url ?? null} />
                <section className="details-card">
                    <form action={updateProfile} className="profile-form">
                        <label>Nickname<input name="nickname" maxLength={40} autoComplete="nickname" placeholder="Your public nickname" defaultValue={profile?.nickname ?? ""} aria-describedby="nickname-help" required /><span id="nickname-help" className="nickname-help">Shown publicly with your avatar on your posts.</span></label>
                        <label>First name<input name="first_name" maxLength={100} autoComplete="given-name" placeholder="Your first name" defaultValue={profile?.first_name ?? ""} required /></label>
                        <label>Last name<input name="last_name" maxLength={100} autoComplete="family-name" placeholder="Your last name" defaultValue={profile?.last_name ?? ""} required /></label>
                        <div className="form-bottom"><SaveButton /></div>
                    </form>
                </section>
            </div>
        </SiteFrame>
    );
}
