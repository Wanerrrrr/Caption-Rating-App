"use client";

import Link from "next/link";
import { useRef, useState, type FormEvent, type DragEvent } from "react";
import Icon from "../components/ui-icon";

export default function GenerateForm({ configured }: { configured: boolean }) {
    const [pending, setPending] = useState(false);
    const [error, setError] = useState("");
    const [result, setResult] = useState<{ caption: string; description: string } | null>(null);
    const busy = useRef(false);
    const [photo, setPhoto] = useState<File | null>(null);
    const [dragging, setDragging] = useState(false);
    const dragDepth = useRef(0);

    function choosePhoto(files: FileList | null) {
        if (busy.current || !files?.length) return;
        setError("");
        setResult(null);
        setPhoto(null);
        if (files.length !== 1) { setError("Choose one image."); return; }
        const file = files[0];
        if (!["image/jpeg", "image/png", "image/webp", "image/gif"].includes(file.type) || !file.size || file.size > 3 * 1024 * 1024) {
            setError("Choose a JPG, PNG, WebP or GIF up to 3 MB.");
            return;
        }
        setPhoto(file);
    }

    function dropPhoto(event: DragEvent<HTMLElement>) {
        event.preventDefault();
        dragDepth.current = 0;
        setDragging(false);
        choosePhoto(event.dataTransfer.files);
    }

    async function submit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        if (busy.current) return;
        const form = new FormData(event.currentTarget);
        setError("");
        setResult(null);
        if (!photo) {
            setError("Choose an image up to 3 MB.");
            return;
        }
        form.set("photo", photo);
        busy.current = true;
        setPending(true);
        try {
            const response = await fetch("/api/generate", { method: "POST", body: form });
            const payload = await response.json();
            if (!response.ok) throw new Error(payload.error || "Generation failed. Please try again.");
            setResult(payload);
        } catch (cause) {
            setError(cause instanceof Error ? cause.message : "Generation failed. Please try again.");
        } finally {
            busy.current = false;
            setPending(false);
        }
    }

    return <div className="generation-layout">
        <form onSubmit={submit} className="details-card profile-form generation-form" aria-busy={pending}>
            <section className="image-upload-card" aria-labelledby="image-upload-heading">
                <h2 id="image-upload-heading">Image</h2>
                <div className={`image-dropzone${dragging ? " is-dragging" : ""}`} onDragEnter={(event) => {
                    event.preventDefault();
                    if (busy.current) return;
                    dragDepth.current += 1;
                    setDragging(true);
                }} onDragOver={(event) => { event.preventDefault(); event.dataTransfer.dropEffect = busy.current ? "none" : "copy"; }} onDragLeave={(event) => {
                    event.preventDefault();
                    dragDepth.current = Math.max(0, dragDepth.current - 1);
                    if (!dragDepth.current) setDragging(false);
                }} onDrop={dropPhoto}>
                    <label className={`image-upload-trigger${pending ? " is-disabled" : ""}`} htmlFor="caption-photo"><Icon name="upload" />{photo ? "Change image" : "Upload"}
                        <input id="caption-photo" name="photo" type="file" accept="image/jpeg,image/png,image/webp,image/gif" disabled={pending} aria-label="Upload image" aria-describedby="photo-help selected-photo" onChange={(event) => { choosePhoto(event.currentTarget.files); event.currentTarget.value = ""; }} />
                    </label>
                    <p className="dropzone-instruction">Choose an image or drag & drop it here.</p>
                    <p id="photo-help" className="dropzone-formats">JPG, PNG, WebP or GIF · Max 3 MB.</p>
                    <p id="selected-photo" className="selected-photo" role="status">{photo?.name ?? ""}</p>
                </div>
            </section>
            <label htmlFor="caption-direction">Creative direction (optional)<input id="caption-direction" name="direction" maxLength={300} placeholder="e.g. Finals week energy" disabled={pending} /></label>
            {!configured && <p role="status">Generation will be available once the app owner finishes AI setup.</p>}
            <button className="pill-button" disabled={pending || !configured}>{pending ? "Describing & captioning…" : "Generate & publish"}<span aria-hidden="true">✳</span></button>
            {error && <p role="alert">{error}</p>}
            <p role="status">{pending ? "This can take up to a minute. Keep this page open." : result ? "Your caption has been published." : ""}</p>
        </form>
        {result && <section className="details-card generation-result" aria-label="Generated caption"><span className="eyebrow">YOUR NEW CAPTION</span><blockquote>{result.caption}</blockquote><details><summary>What AI saw in your photo</summary><p>{result.description}</p></details><Link className="pill-button" href="/">See it in the collection ↗</Link></section>}
    </div>;
}
