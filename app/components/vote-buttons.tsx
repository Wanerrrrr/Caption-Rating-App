"use client";

import { useRef, useState, useTransition } from "react";
import { submitVote } from "../votes/actions";
import Icon from "./ui-icon";

export default function VoteButtons({ captionId, initialVote, unavailable = false, onVoteSaved }: {
    captionId: number; initialVote: 1 | -1 | null; unavailable?: boolean; onVoteSaved?: () => void;
}) {
    const [savedVote, setSavedVote] = useState<1 | -1 | null>(null);
    const [error, setError] = useState("");
    const [pending, startTransition] = useTransition();
    const busy = useRef(false);
    const currentVote = savedVote ?? initialVote;

    function like() {
        if (busy.current || currentVote !== null || unavailable) return;
        busy.current = true;
        setError("");
        startTransition(async () => {
            try {
                const result = await submitVote(captionId, 1);
                if (!result.ok) { setError(result.error); return; }
                setSavedVote(result.vote);
                onVoteSaved?.();
            } catch {
                setError("Your like could not be confirmed. Refresh to check it before trying again.");
            } finally { busy.current = false; }
        });
    }

    const title = unavailable ? "Refresh to load your likes" : currentVote === 1 ? "Liked" : currentVote === -1 ? "An earlier rating is already saved" : "Like this caption";
    return <>
        <button className="caption-like" type="button" aria-label={`Like caption ${captionId}`}
            title={title} aria-pressed={currentVote === 1} aria-busy={pending}
            disabled={pending || currentVote !== null || unavailable} onClick={like}><Icon name="saved" /></button>
        <span className="visually-hidden" role="status">{pending ? "Saving like…" : savedVote === 1 ? "Like saved." : unavailable ? "Likes unavailable. Please refresh." : ""}</span>
        {error && <p className="like-error" role="alert">{error}</p>}
    </>;
}
