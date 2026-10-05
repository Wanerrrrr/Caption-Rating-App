import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { hasCompleteName } from "@/lib/profile";
import SiteFrame from "../components/site-frame";
import GenerateForm from "./generate-form";

export default async function CreatePage() {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user || data.user.is_anonymous) redirect("/login");
    const { data: profile, error: profileError } = await supabase.from("profiles").select("first_name, last_name, avatar_url").eq("id", data.user.id).maybeSingle();
    if (profileError) throw new Error("Unable to load your profile. Please try again.");
    if (!hasCompleteName(profile)) redirect("/profile");
    return <SiteFrame active="create" profile={profile}>
        <div className="page-intro"><h1>Make a caption</h1><p>Upload an image and let AI turn it into a caption.</p></div>
        <GenerateForm configured={Boolean(process.env.GEMINI_API_KEY)} />
    </SiteFrame>;
}
