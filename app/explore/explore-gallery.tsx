"use client";

import PostMeta from "../components/post-meta";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { exploreCaptions, sortOptions, themes, type ExploreCaption, type ExploreSort, type ThemeId } from "@/lib/explore";
import CaptionPhoto from "../components/caption-photo";
import VoteButtons from "../components/vote-buttons";
import Icon from "../components/ui-icon";
import ShareCaption from "../components/share-caption";

export default function ExploreGallery({ captions, votesUnavailable, searchQuery = "", initialLikedOnly = false, contest = false, memberFeed = false }: { captions: ExploreCaption[]; votesUnavailable: boolean; searchQuery?: string; initialLikedOnly?: boolean; contest?: boolean; memberFeed?: boolean }) {
    const [likedOnly, setLikedOnly] = useState(initialLikedOnly);
    const [theme, setTheme] = useState<ThemeId>("all");
    const [sort, setSort] = useState<ExploreSort>("newest");
    const [opened, setOpened] = useState(false);
    const [hovered, setHovered] = useState(false);
    const filter = useRef<HTMLDivElement>(null);
    const filterButton = useRef<HTMLButtonElement>(null);
    const gallery = useRef<HTMLDivElement>(null);
    const router = useRouter();
    const visible = opened || hovered;
    const displayed = contest || memberFeed ? captions : exploreCaptions(likedOnly ? captions.filter(caption => caption.ownVote === 1) : captions, theme, sort, searchQuery);
    useEffect(() => {
        // Reserve each card's natural height in the four-pixel masonry grid.
        // Observing the cards also handles loaded images, GIFs and viewport changes.
        const cards = gallery.current?.querySelectorAll<HTMLElement>(".caption-card");
        if (!cards) return;
        const measure = (card: HTMLElement) => {
            const span = Math.ceil((card.getBoundingClientRect().height + 16) / 4);
            card.style.gridRowEnd = `span ${span}`;
        };
        const observer = new ResizeObserver(entries => {
            for (const entry of entries) measure(entry.target as HTMLElement);
        });
        cards.forEach(card => { measure(card); observer.observe(card); });
        return () => observer.disconnect();
    }, [captions, theme, sort, searchQuery, likedOnly]);
    useEffect(() => {
        function outside(event: PointerEvent) {
            if (!filter.current?.contains(event.target as Node)) { setOpened(false); setHovered(false); }
        }
        function escape(event: KeyboardEvent) {
            if (event.key === "Escape" && visible) {
                setOpened(false); setHovered(false); filterButton.current?.focus();
            }
        }
        document.addEventListener("pointerdown", outside);
        document.addEventListener("keydown", escape);
        return () => {
            document.removeEventListener("pointerdown", outside);
            document.removeEventListener("keydown", escape);
        };
    }, [visible]);
    return <div className={`explore-content${memberFeed ? " member-posted-feed" : ""}`}>
        {!memberFeed && (contest ? <h2 className="visually-hidden">Challenge entries</h2> : <h1 className="visually-hidden">Explore captions</h1>)}
        {!contest && !memberFeed && <nav className="theme-options" aria-label="Caption themes">{themes.map(item =>
            <button key={item.id} type="button" className="theme-option" aria-pressed={theme === item.id}
                onClick={() => setTheme(item.id)}>{item.label}</button>
        )}</nav>}
        {!contest && !memberFeed && <div className="explore-toolbar">
            {searchQuery && <div className="search-results-summary"><p role="status">{displayed.length} {displayed.length === 1 ? "result" : "results"} for <strong>“{searchQuery}”</strong></p><Link href="/explore">Clear</Link></div>}
            <div ref={filter} className="explore-filter" onPointerEnter={event => { if (event.pointerType === "mouse") setHovered(true); }}
                onPointerLeave={() => setHovered(false)} onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) setOpened(false); }}
                onKeyDown={event => { if (event.key === "Escape") { setOpened(false); setHovered(false); filterButton.current?.focus(); } }}>
                <button ref={filterButton} className="filter-button" type="button" aria-expanded={visible} aria-controls="explore-sort-options"
                    aria-label={`Filter: ${sortOptions.find(option => option.id === sort)?.label}${likedOnly ? ", Liked by me" : ""}`} onClick={() => setOpened(value => !value)}><Icon name="filter" />Filter<Icon name="chevron" /></button>
                {visible && <fieldset id="explore-sort-options" className="filter-dropdown"><legend className="visually-hidden">Sort captions</legend>
                    <label className="sort-option liked-filter-option"><input type="checkbox" checked={likedOnly} disabled={votesUnavailable} onChange={event => setLikedOnly(event.target.checked)} /><span>Liked by me</span></label>
                    {votesUnavailable && <p role="status" className="filter-notice">Couldn’t load your likes. Please refresh.</p>}
                    {sortOptions.map(option => <label className="sort-option" key={option.id}>
                        <input type="radio" name="explore-sort" checked={sort === option.id} onChange={() => { setSort(option.id); }} />
                        <span>{option.label}</span>
                    </label>)}
                </fieldset>}
            </div>
        </div>}
        <section className="gallery-section explore-gallery" aria-label={memberFeed ? "Member posts" : contest ? "Challenge entries" : likedOnly ? "Liked captions" : "Explore captions"}>
            {memberFeed && <h2 className="folder-tab posted-tab">Posted</h2>}
            <div className="gallery-container">
                {displayed.length ? <div ref={gallery} key={`${theme}:${sort}:${likedOnly}`} className="caption-grid explore-masonry" role="region" aria-label={memberFeed ? "Member posts — scroll down to browse" : contest ? "Challenge entries — scroll down to browse" : likedOnly ? "Liked feed — scroll down to browse" : "Explore feed — scroll down to browse"} tabIndex={0}>
                    {displayed.map(caption => <article className="caption-card" key={caption.id} data-caption-id={caption.id}>
                        <VoteButtons captionId={caption.id} initialVote={caption.ownVote} likeCount={caption.like_count} unavailable={votesUnavailable} votingClosed={caption.votingClosed} onVoteSaved={() => router.refresh()} />
                        {caption.image_url ? <CaptionPhoto src={caption.image_url} alt={caption.image_alt ?? caption.image_description ?? "Caption photo"} /> :
                            <div className="caption-photo photo-placeholder"><span className="photo-unavailable">Photo unavailable</span></div>}
                        <div className="caption-content">{caption.challenge_id && <span className="challenge-post-label">{contest && caption.rank ? `#${caption.rank}${caption.reward ? ` · +${caption.reward} credits` : ""}` : "Weekly challenge"}</span>}<blockquote>{caption.caption}</blockquote><PostMeta author={caption.author ?? { nickname: "Member", avatar_url: null }} createdAt={caption.created_at} /></div>
                        <ShareCaption id={caption.id} caption={caption.caption} hasImage={Boolean(caption.image_url)} />
                    </article>)}
                </div> : <div className="explore-empty" role="status"><p>{likedOnly ? "No liked captions match these filters." : memberFeed ? "No posts yet." : contest ? "Be the first to enter this week’s challenge." : searchQuery ? "No matching captions. Try another keyword." : "No captions here yet."}</p>{likedOnly ? <button type="button" className="pill-button" onClick={() => setLikedOnly(false)}>Show all captions</button> : theme !== "all" ? <button type="button" className="pill-button" onClick={() => setTheme("all")}>View all themes</button> : <Link className="pill-button" href="/explore">{searchQuery ? "Clear search" : "View all"}</Link>}</div>}
            </div>
        </section>
    </div>;
}
