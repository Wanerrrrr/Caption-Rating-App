import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { hasCompleteName } from "@/lib/profile";
import CaptionPhoto from "./components/caption-photo";
import SiteFrame from "./components/site-frame";

export default async function Home() {
    const supabase = await createClient();
    const { data, error: authError } = await supabase.auth.getClaims();
    const userId = data?.claims?.sub;
    if (authError || !userId) redirect("/login");

    const { data: profile, error: profileError } = await supabase.from("profiles")
        .select("first_name, last_name").eq("id", userId).maybeSingle();
    if (profileError) throw new Error("Unable to load your profile. Please try again.");
    if (!hasCompleteName(profile)) redirect("/profile");

    const { data: captions, error } = await supabase.from("captions")
        .select("id, caption, image_url, image_alt, image_source_url, image_credit").order("id", { ascending: true });

    return <SiteFrame active="captions">
        <div className="page-intro collection-heading">
            <h1>Captions</h1><span>{captions?.length ?? 0} captions</span>
        </div>
        {error ? <p role="alert" className="collection-notice">We couldn’t load the captions. Please refresh to try again.</p> :
            captions?.length ? <div className="caption-grid">{captions.map((caption, index) =>
                <article className="caption-card" key={caption.id}>
                    {caption.image_url && <CaptionPhoto key={caption.image_url} src={caption.image_url} alt={caption.image_alt ?? "Caption photo"} />}
                    <div className="caption-content">
                    <div className="card-heading"><span className="eyebrow">CAPTION {String(index + 1).padStart(2, "0")}</span><span aria-hidden="true">✳</span></div>
                    <blockquote>{caption.caption}</blockquote>
                    {caption.image_source_url && <a className="photo-credit" href={caption.image_source_url} target="_blank" rel="noopener noreferrer">Photo: {caption.image_credit ?? "Pexels"} ↗</a>}
                    </div>
                </article>
            )}</div> : <p className="collection-notice">No captions yet.</p>}
    </SiteFrame>;
}
