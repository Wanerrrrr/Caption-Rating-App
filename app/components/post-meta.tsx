"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useState } from "react";
import type { PostAuthor } from "@/lib/post-authors";
import { formatPostTime } from "@/lib/post-time";
import Icon from "./ui-icon";

export default function PostMeta({ author, createdAt, canViewProfile = true }: { author: PostAuthor; createdAt: string; canViewProfile?: boolean }) {
    const [label, setLabel] = useState("");
    const [failedAvatar, setFailedAvatar] = useState<string | null>(null);
    useEffect(() => {
        const update = () => setLabel(formatPostTime(createdAt));
        update();
        const timer = setInterval(update, 30_000);
        window.addEventListener("focus", update);
        return () => { clearInterval(timer); window.removeEventListener("focus", update); };
    }, [createdAt]);
    const identity = <><span className="post-author-avatar">{author.avatar_url && failedAvatar !== author.avatar_url ? <Image src={author.avatar_url} width={28} height={28} alt="" unoptimized onError={() => setFailedAvatar(author.avatar_url)} /> : <Icon name="user" />}</span><span className="post-author-name" title={author.nickname}>{author.nickname}</span></>;
    return <div className="post-meta">
        {author.id && canViewProfile ? <Link className="post-author" href={`/members/${author.id}`} aria-label={`View ${author.nickname}’s profile`}>{identity}</Link> : <div className="post-author">{identity}</div>}
        <time dateTime={createdAt} title={label}>{label || "…"}</time>
    </div>;
}
