"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import type { PostAuthor } from "@/lib/post-authors";
import { formatPostTime } from "@/lib/post-time";
import Icon from "./ui-icon";

export default function PostMeta({ author, createdAt }: { author: PostAuthor; createdAt: string }) {
    const [label, setLabel] = useState("");
    const [failedAvatar, setFailedAvatar] = useState<string | null>(null);
    useEffect(() => {
        const update = () => setLabel(formatPostTime(createdAt));
        update();
        const timer = setInterval(update, 30_000);
        window.addEventListener("focus", update);
        return () => { clearInterval(timer); window.removeEventListener("focus", update); };
    }, [createdAt]);
    return <div className="post-meta">
        <div className="post-author"><span className="post-author-avatar">{author.avatar_url && failedAvatar !== author.avatar_url ? <Image src={author.avatar_url} width={28} height={28} alt="" unoptimized onError={() => setFailedAvatar(author.avatar_url)} /> : <Icon name="user" />}</span><span className="post-author-name" title={author.nickname}>{author.nickname}</span></div>
        <time dateTime={createdAt} title={label}>{label || "…"}</time>
    </div>;
}
