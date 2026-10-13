"use client";

import Link from "next/link";
import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { removeLike, submitVote } from "../votes/actions";
import Icon from "./ui-icon";

export default function VoteButtons({ captionId, initialVote, unavailable = false, onVoteSaved, likeCount, votingClosed = false, guest = false }: {
    captionId: number; initialVote: 1 | -1 | null; unavailable?: boolean; onVoteSaved?: () => void; likeCount?: number; votingClosed?: boolean; guest?: boolean;
}) {
    const [savedVote, setSavedVote] = useState<{ vote: 1 | -1 | null } | null>(null);
    const [error, setError] = useState("");
    const [pending, startTransition] = useTransition();
    const busy = useRef(false);
    const router = useRouter();
    const currentVote = savedVote === null ? initialVote : savedVote.vote;

    function like() {
        if (guest || busy.current || currentVote === -1 || unavailable || votingClosed) return;
        busy.current = true;
        setError("");
        startTransition(async () => {
            try {
                const result = await (currentVote === 1 ? removeLike(captionId) : submitVote(captionId, 1));
                if (!result.ok) { setError(result.error); return; }
                setSavedVote({ vote: result.vote });
                if (onVoteSaved) onVoteSaved(); else router.refresh();
            } catch {
                setError("Your like could not be confirmed. Refresh to check it before trying again.");
            } finally { busy.current = false; }
        });
    }

    const title = guest ? "Sign in to like captions" : votingClosed ? "Challenge voting has closed" : unavailable ? "Refresh to load your likes" : currentVote === 1 ? "Unlike this caption" : currentVote === -1 ? "An earlier rating is already saved" : "Like this caption";
    if (guest) return <Link href="/login" className={`caption-like${likeCount === undefined ? "" : " caption-like-counted"}`} title={title} aria-label={`Sign in to like caption ${captionId}`}>
        <Icon name="saved" />{likeCount !== undefined && <span className="like-total"><span className="visually-hidden">Total likes: </span>{likeCount}</span>}
    </Link>;
    return <>
        <button className={`caption-like${likeCount === undefined ? "" : " caption-like-counted"}`} type="button" aria-label={`${currentVote === 1 ? "Unlike" : "Like"} caption ${captionId}`}
            aria-describedby={likeCount === undefined ? undefined : `like-total-${captionId}`}
            title={title} aria-pressed={currentVote === 1} aria-busy={pending}
            disabled={guest || pending || currentVote === -1 || unavailable || votingClosed} onClick={like}><Icon name="saved" />{likeCount !== undefined && <span className="like-total" id={`like-total-${captionId}`}><span className="visually-hidden">Total likes: </span>{likeCount}</span>}</button>
        <span className="visually-hidden" role="status">{pending ? "Saving…" : savedVote ? (savedVote.vote === 1 ? "Like saved." : "Like removed.") : unavailable ? "Likes unavailable. Please refresh." : ""}</span>
        {error && <p className="like-error" role="alert">{error}</p>}
    </>;
}
