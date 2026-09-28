"use client";

import Image from "next/image";
import { useRef, useState, type ChangeEvent } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { saveAvatarUrl } from "./actions";

const extensions: Record<string, string> = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "image/gif": "gif",
};

export default function AvatarUpload({ userId, currentAvatarUrl }: {
    userId: string;
    currentAvatarUrl: string | null;
}) {
    const [uploading, setUploading] = useState(false);
    const [savedUrl, setSavedUrl] = useState<string | null>(null);
    const [error, setError] = useState("");
    const [message, setMessage] = useState("");
    const busy = useRef(false);
    const router = useRouter();
    const avatarUrl = savedUrl ?? currentAvatarUrl;

    async function handleUpload(event: ChangeEvent<HTMLInputElement>) {
        const input = event.currentTarget;
        const file = input.files?.[0];
        if (!file || busy.current) return;
        setError("");
        setMessage("");
        const extension = extensions[file.type];
        if (!extension || file.size === 0 || file.size > 5 * 1024 * 1024) {
            setError("Choose a JPG, PNG, WebP, or GIF image up to 5 MB.");
            input.value = "";
            return;
        }

        busy.current = true;
        setUploading(true);
        try {
            const supabase = createClient();
            const filePath = `${userId}/${crypto.randomUUID()}.${extension}`;
            const { error: uploadError } = await supabase.storage
                .from("avatars")
                .upload(filePath, file, { contentType: file.type });
            if (uploadError) throw new Error(uploadError.message);

            const result = await saveAvatarUrl(filePath);
            if (result.error) throw new Error(result.error);
            if (!result.avatarUrl) throw new Error("Your photo could not be saved.");
            setSavedUrl(result.avatarUrl);
            setMessage("Photo saved.");
            router.refresh();
        } catch (cause) {
            setError(cause instanceof Error ? cause.message : "Avatar upload failed. Please try again.");
        } finally {
            busy.current = false;
            setUploading(false);
            input.value = "";
        }
    }

    return (
        <section className="avatar-card" aria-label="Profile photo" aria-busy={uploading}>
            <h2 className="photo-heading">Profile photo</h2>
            <div className="portrait-stage">
                {avatarUrl ? (
                    <Image className="avatar-image" src={avatarUrl} alt="Profile photo" width={180} height={180} unoptimized />
                ) : (
                    <div className="avatar-placeholder" role="img" aria-label="No profile photo"><svg viewBox="0 0 120 120" fill="none" aria-hidden="true"><circle cx="60" cy="43" r="21" fill="currentColor"/><path d="M21 106c0-25 17-40 39-40s39 15 39 40" fill="currentColor"/></svg></div>
                )}
            </div>
            <label className="upload-button">
                <span aria-hidden="true">↑</span> {uploading ? "Uploading…" : avatarUrl ? "Change photo" : "Upload photo"}
                <input id="avatar-file" type="file" accept="image/jpeg,image/png,image/webp,image/gif" onChange={handleUpload} disabled={uploading} aria-describedby="avatar-help" />
            </label>
            <p id="avatar-help" className="upload-help">JPG, PNG, WebP or GIF · Up to 5 MB</p>
            {error && <p role="alert" className="upload-error">{error}</p>}
            <p role="status" className="upload-status">{message}</p>
        </section>
    );
}
