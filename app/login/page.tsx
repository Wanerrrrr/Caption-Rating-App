"use client";

import SiteFrame from "../components/site-frame";

import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
    const handleGoogleLogin = async () => {
        const supabase = createClient();

        const { error } = await supabase.auth.signInWithOAuth({
            provider: "google",
            options: {
                redirectTo: `${window.location.origin}/auth/callback`,
            },
        });

        if (error) {
            console.error("Login error:", error.message);
        }
    };

    return (
        <SiteFrame active="login">
            <section className="login-card">
                <h1>Sign in</h1>
                <button onClick={handleGoogleLogin} className="pill-button">Sign in with Google <span aria-hidden="true">↗</span></button>
            </section>
        </SiteFrame>
    );
}
