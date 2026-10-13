"use client";

import Link from "next/link";
import Image from "next/image";
import { useState } from "react";
import Icon from "./ui-icon";

export type FrameProfile = { first_name: string | null; last_name: string | null; avatar_url: string | null; nickname?: string | null };

export default function ProfileSummary({ profile, badges = [] }: { profile?: FrameProfile | null; badges?: {id:string;name:string}[] }) {
    const [failedUrl, setFailedUrl] = useState<string | null>(null);
    const name = profile?.nickname || [profile?.first_name, profile?.last_name].filter(Boolean).join(" ") || "Your profile";
    const avatar = profile?.avatar_url;
    return <div className="profile-summary">
        <Link className="summary-avatar" href="/me" aria-label="My public profile">
            {avatar && failedUrl !== avatar ? <Image src={avatar} alt="Your profile photo" width={72} height={72} unoptimized onError={() => setFailedUrl(avatar)} /> : <Icon name="user" />}
        </Link>
        <div><div className="summary-name"><h2>{name}</h2><Link className="profile-edit-icon" href="/profile" aria-label="Edit profile" title="Edit profile"><Icon name="pencil" /></Link></div>{badges.length > 0 && <div className="summary-badges" aria-label="Displayed badges">{badges.map(badge=><span key={badge.id} className="summary-badge" title={badge.name} aria-label={badge.name}><Icon name="award"/></span>)}</div>}</div>
    </div>;
}
