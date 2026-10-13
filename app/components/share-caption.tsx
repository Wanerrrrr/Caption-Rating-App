"use client";

import Link from "next/link";
import Image from "next/image";
import { createPortal } from "react-dom";
import { useEffect, useRef, useState } from "react";
import Icon from "./ui-icon";
import { makeShareImage } from "@/lib/share-image";

export default function ShareCaption({ id, caption, hasImage, guest = false }: { id: number; caption: string; hasImage: boolean; guest?: boolean }) {
    const [open, setOpen] = useState(false), [busy, setBusy] = useState(false);
    const [message, setMessage] = useState(""), [manualLink, setManualLink] = useState("");
    const [preview, setPreview] = useState(""), [shareable, setShareable] = useState(false);
    const [position, setPosition] = useState({ left: 16, top: 16, width: 420 });
    const [url, setUrl] = useState("");
    const trigger = useRef<HTMLButtonElement>(null), panel = useRef<HTMLDivElement>(null);
    const closeButton = useRef<HTMLButtonElement>(null), urlRef = useRef("");
    const fileRef = useRef<File | null>(null), pending = useRef<Promise<File> | null>(null);
    const mounted = useRef(true);
    const postUrl = () => `${window.location.origin}/post/${id}`;
    useEffect(() => {
        mounted.current = true;
        return () => { mounted.current = false; if (urlRef.current) URL.revokeObjectURL(urlRef.current); };
    }, []);
    useEffect(() => {
        if (!open) return;
        function place() {
            const anchor = trigger.current?.getBoundingClientRect();
            if (!anchor) return;
            const width = Math.min(420, window.innerWidth - 32);
            const height = Math.min(620, window.innerHeight - 32);
            // Prefer the right of the card, while keeping the entire panel on screen.
            const left = Math.max(16, Math.min(anchor.right + 12, window.innerWidth - width - 16));
            const top = Math.max(16, Math.min(anchor.top - 16, window.innerHeight - height - 16));
            setPosition({ left, top, width });
        }
        function outside(event: PointerEvent) {
            if (!panel.current?.contains(event.target as Node) && !trigger.current?.contains(event.target as Node)) setOpen(false);
        }
        function escape(event: KeyboardEvent) {
            if (event.key === "Escape") { setOpen(false); trigger.current?.focus(); }
        }
        function other(event: Event) {
            if ((event as CustomEvent<number>).detail !== id) setOpen(false);
        }
        place(); closeButton.current?.focus();
        window.addEventListener("resize", place);
        document.addEventListener("scroll", place, true);
        document.addEventListener("pointerdown", outside);
        document.addEventListener("keydown", escape);
        window.addEventListener("caption-share-open", other);
        return () => {
            window.removeEventListener("resize", place);
            document.removeEventListener("scroll", place, true);
            document.removeEventListener("pointerdown", outside);
            document.removeEventListener("keydown", escape);
            window.removeEventListener("caption-share-open", other);
        };
    }, [open, id]);
    async function prepare(): Promise<File> {
        if (fileRef.current) return fileRef.current;
        if (pending.current) return pending.current;
        setBusy(true); setMessage("");
        pending.current = (async () => {
            const blob = await makeShareImage(id, caption);
            const file = new File([blob], `caption-club-${id}.png`, { type: "image/png" });
            if (!mounted.current) throw new Error("Image preview closed.");
            urlRef.current = URL.createObjectURL(blob); fileRef.current = file;
            setPreview(urlRef.current);
            setShareable(Boolean(typeof navigator.share === "function" && navigator.canShare?.({ files: [file] })));
            return file;
        })();
        try { return await pending.current; }
        finally { pending.current = null; if (mounted.current) setBusy(false); }
    }
    function report(error: unknown) {
        if (mounted.current) setMessage(error instanceof Error ? error.message : "Could not make the image. Please retry.");
    }
    function show() {
        if (open) { setOpen(false); return; }
        setUrl(postUrl()); setOpen(true); setMessage("");
        window.dispatchEvent(new CustomEvent("caption-share-open", { detail: id }));
        if (hasImage) void prepare().catch(report);
    }
    async function copy() {
        try { await navigator.clipboard.writeText(postUrl()); setMessage("Link copied!"); setManualLink(""); }
        catch { setManualLink(postUrl()); setMessage("Copy the link below."); }
    }
    async function download() {
        try {
            await prepare();
            const link = document.createElement("a");
            link.href = urlRef.current; link.download = `caption-club-${id}.png`;
            document.body.appendChild(link); link.click(); link.remove();
        } catch (error) { report(error); }
    }
    async function shareImage() {
        if (!navigator.share || !shareable || !fileRef.current) { setMessage("Download the image to share it in another app."); return; }
        try {
            await navigator.share({ files: [fileRef.current] });
        } catch (error) {
            if (!(error instanceof Error && error.name === "AbortError")) setMessage("Sharing unavailable. Try downloading the image.");
        }
    }
    if (guest) return <div className="caption-share"><div className="caption-share-tools">
        <Link href="/login" className="share-icon-button" aria-label={`Sign in to share caption ${id}`} title="Sign in to share"><Icon name="share" /></Link>
        <Link href="/login" className="share-icon-button" aria-label={`Sign in to download caption ${id} image`} title="Sign in to download"><Icon name="download" /></Link>
    </div></div>;
    const encoded = encodeURIComponent(url);
    return <div className="caption-share">
        <div className="caption-share-tools">
            <button ref={trigger} type="button" className="share-icon-button" aria-label={`Share caption ${id}`} title="Share" aria-expanded={open} aria-controls={open ? `share-panel-${id}` : undefined} onClick={show}><Icon name="share" /></button>
            <button type="button" className="share-icon-button" aria-label={`Download caption ${id} image`} title="Download image" onClick={download} disabled={!hasImage || busy}><Icon name="download" /></button>
        </div>
        {!open && message && <p className="share-status" role="status">{message}</p>}
        {open && createPortal(<div ref={panel} id={`share-panel-${id}`} className="share-popover" role="dialog" aria-label={`Share caption ${id}`} style={position}>
            <div className="share-popover-heading"><h2>Share</h2><button ref={closeButton} type="button" className="share-close" aria-label="Close share panel" onClick={() => { setOpen(false); trigger.current?.focus(); }}><Icon name="close" /></button></div>
            <p className="share-group-label">Share link</p>
            <div className="share-apps">
                <button type="button" onClick={copy}><span className="share-app-icon copy"><Icon name="link" /></span><span>Copy link</span></button>
                <a href={`https://wa.me/?text=${encoded}`} target="_blank" rel="noopener noreferrer"><span className="share-app-icon whatsapp"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 11.5a8 8 0 0 1-12 7L3 20l1.5-5A8 8 0 1 1 20 11.5Z" fill="none" stroke="currentColor" strokeWidth="1.7"/><path d="M8 7c-2 2 3 8 6 7l1-2-3-1-1 1-2-3 1-1Z" fill="currentColor"/></svg></span><span>WhatsApp</span></a>
                <a href={`https://t.me/share/url?url=${encoded}`} target="_blank" rel="noopener noreferrer"><span className="share-app-icon telegram"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m3 11 18-7-4 16-6-5-3 3 1-6 9-6-11 7Z" fill="currentColor"/></svg></span><span>Telegram</span></a>
                <a href={`https://www.facebook.com/sharer/sharer.php?u=${encoded}`} target="_blank" rel="noopener noreferrer"><span className="share-app-icon facebook">f</span><span>Facebook</span></a>
                <a href={`https://x.com/intent/tweet?url=${encoded}`} target="_blank" rel="noopener noreferrer"><span className="share-app-icon x">𝕏</span><span>X</span></a>
            </div>
            {manualLink && <input aria-label="Post link" value={manualLink} readOnly onFocus={event => event.currentTarget.select()} />}
            {hasImage && <div className="share-image-preview">
                {preview ? <Image src={preview} width={1080} height={1400} alt="Share image with caption above the photo" unoptimized /> : <div className="share-preview-loading" role="status">{busy ? "Making your image…" : "Image unavailable."}{!busy && <button type="button" onClick={() => void prepare().catch(report)}>Retry</button>}</div>}
                {preview && <button type="button" className="share-image-action" onClick={shareImage}><Icon name="share" />Share image</button>}
            </div>}
            {message && <p className="share-status" role="status">{message}</p>}
        </div>, document.body)}
    </div>;
}
