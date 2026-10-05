"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { exploreCaptions, sortOptions, themes, type ExploreCaption, type ExploreSort, type ThemeId } from "@/lib/explore";
import CaptionPhoto from "../components/caption-photo";
import VoteButtons from "../components/vote-buttons";
import Icon from "../components/ui-icon";

export default function ExploreGallery({ captions, votesUnavailable, searchQuery = "" }: { captions: ExploreCaption[]; votesUnavailable: boolean; searchQuery?: string }) {
    const [theme, setTheme] = useState<ThemeId>("all");
    const [sort, setSort] = useState<ExploreSort>("newest");
    const [opened, setOpened] = useState(false);
    const [hovered, setHovered] = useState(false);
    const filter = useRef<HTMLDivElement>(null);
    const filterButton = useRef<HTMLButtonElement>(null);
    const gallery = useRef<HTMLDivElement>(null);
    const router = useRouter();
    const visible = opened || hovered;
    const displayed = exploreCaptions(captions, theme, sort, searchQuery);
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
    }, [captions, theme, sort, searchQuery]);
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
    return <div className="explore-content">
        <h1 className="visually-hidden">Explore captions</h1>
        <nav className="theme-options" aria-label="Caption themes">{themes.map(item =>
            <button key={item.id} type="button" className="theme-option" aria-pressed={theme === item.id}
                onClick={() => setTheme(item.id)}>{item.label}</button>
        )}</nav>
        <div className="explore-toolbar">
            {searchQuery && <div className="search-results-summary"><p role="status">{displayed.length} {displayed.length === 1 ? "result" : "results"} for <strong>“{searchQuery}”</strong></p><Link href="/explore">Clear</Link></div>}
            <div ref={filter} className="explore-filter" onPointerEnter={event => { if (event.pointerType === "mouse") setHovered(true); }}
                onPointerLeave={() => setHovered(false)} onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) setOpened(false); }}
                onKeyDown={event => { if (event.key === "Escape") { setOpened(false); setHovered(false); filterButton.current?.focus(); } }}>
                <button ref={filterButton} className="filter-button" type="button" aria-expanded={visible} aria-controls="explore-sort-options"
                    aria-label={`Filter: ${sortOptions.find(option => option.id === sort)?.label}`} onClick={() => setOpened(value => !value)}><Icon name="filter" />Filter<Icon name="chevron" /></button>
                {visible && <fieldset id="explore-sort-options" className="filter-dropdown"><legend className="visually-hidden">Sort captions</legend>
                    {sortOptions.map(option => <label className="sort-option" key={option.id}>
                        <input type="radio" name="explore-sort" checked={sort === option.id} onChange={() => { setSort(option.id); }} />
                        <span>{option.label}</span>
                    </label>)}
                </fieldset>}
            </div>
        </div>
        <section className="gallery-section explore-gallery" aria-label="Explore captions">
            <div className="gallery-container">
                {displayed.length ? <div ref={gallery} key={`${theme}:${sort}`} className="caption-grid explore-masonry" role="region" aria-label="Explore feed — scroll down to browse" tabIndex={0}>
                    {displayed.map(caption => <article className="caption-card" key={caption.id} data-caption-id={caption.id}>
                        <VoteButtons captionId={caption.id} initialVote={caption.ownVote} unavailable={votesUnavailable} onVoteSaved={() => router.refresh()} />
                        {caption.image_url ? <CaptionPhoto src={caption.image_url} alt={caption.image_alt ?? caption.image_description ?? "Caption photo"} /> :
                            <div className="caption-photo photo-placeholder"><span className="photo-unavailable">Photo unavailable</span></div>}
                        <div className="caption-content"><blockquote>{caption.caption}</blockquote></div>
                    </article>)}
                </div> : <div className="explore-empty" role="status"><p>{searchQuery ? "No matching captions. Try another keyword." : "No captions here yet."}</p>{theme !== "all" ? <button type="button" className="pill-button" onClick={() => setTheme("all")}>View all themes</button> : <Link className="pill-button" href="/explore">{searchQuery ? "Clear search" : "View all"}</Link>}</div>}
            </div>
        </section>
    </div>;
}
