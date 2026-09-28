import Link from "next/link";
import { hasCompleteName } from "@/lib/profile";
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
        .select("first_name, last_name, avatar_url")
        .eq("id", userId)
        .maybeSingle();

    if (profileError) throw new Error("Unable to load your profile. Please try again.");
    const incomplete = !hasCompleteName(profile);

    return (
        <SiteFrame active="profile">
            <div className="page-intro">
                <h1>Profile</h1>
                {incomplete && <p>Please enter your first and last name.</p>}
            </div>
            {params.error === "name" && <p role="alert" className="collection-notice">Please enter both names, using 1–100 characters each.</p>}
            {params.saved === "1" && <p role="status" className="collection-notice">Profile saved. <Link href="/">Continue to captions ↗</Link></p>}
            <div className="profile-grid">
                <AvatarUpload userId={userId} currentAvatarUrl={profile?.avatar_url ?? null} />
                <section className="details-card">
                    <form action={updateProfile} className="profile-form">
                        <label>First name<input name="first_name" maxLength={100} autoComplete="given-name" placeholder="Your first name" defaultValue={profile?.first_name ?? ""} required /></label>
                        <label>Last name<input name="last_name" maxLength={100} autoComplete="family-name" placeholder="Your last name" defaultValue={profile?.last_name ?? ""} required /></label>
                        <div className="form-bottom"><SaveButton /></div>
                    </form>
                </section>
            </div>
        </SiteFrame>
    );
}
