"use client";

import Image from "next/image";
import { useState } from "react";
import Icon from "./ui-icon";

export type FrameProfile = { first_name: string | null; last_name: string | null; avatar_url: string | null };

export default function ProfileSummary({ profile }: { profile?: FrameProfile | null }) {
    const [failedUrl, setFailedUrl] = useState<string | null>(null);
    const name = [profile?.first_name, profile?.last_name].filter(Boolean).join(" ") || "Your profile";
    const avatar = profile?.avatar_url;
    return <div className="profile-summary">
        <div className="summary-avatar">
            {avatar && failedUrl !== avatar ? <Image src={avatar} alt="Your profile photo" width={72} height={72} unoptimized onError={() => setFailedUrl(avatar)} /> : <Icon name="user" />}
        </div>
        <div><span className="eyebrow">YOUR LITTLE CORNER</span><h2>{name}</h2><p>Caption Club member</p></div>
    </div>;
}
