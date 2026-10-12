import { createClient } from "@/lib/supabase/server";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    if (!/^\d+$/.test(id) || !Number.isSafeInteger(Number(id)) || Number(id) <= 0) return new Response("Not found", { status: 404 });
    const supabase = await createClient();
    const { data, error } = await supabase.from("captions").select("image_url").eq("id", Number(id)).maybeSingle();
    if (error) return new Response("Image unavailable", { status: 503 });
    if (!data?.image_url) return new Response("Not found", { status: 404 });
    try {
        const url = new URL(data.image_url);
        const storageHost = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL!).hostname;
        // Only published images from known providers; never arbitrary proxy URLs or redirects.
        if (url.protocol !== "https:" || url.port || url.username || url.password ||
            !(url.hostname === "images.pexels.com" || (url.hostname === storageHost && url.pathname.startsWith("/storage/v1/object/public/caption-images/")))) return new Response("Unsupported image source", { status: 400 });
        const response = await fetch(url, { redirect: "error", signal: AbortSignal.timeout(15_000) });
        const type = response.headers.get("content-type")?.split(";")[0] ?? "";
        if (!response.ok || !["image/jpeg", "image/png", "image/webp", "image/gif"].includes(type) || !response.body) return new Response("Image unavailable", { status: 502 });
        const reader = response.body.getReader(), chunks: Uint8Array[] = [];
        let size = 0;
        while (true) {
            const { value, done } = await reader.read();
            if (done) break;
            size += value.byteLength;
            if (size > 10 * 1024 * 1024) { await reader.cancel(); return new Response("Image too large", { status: 413 }); }
            chunks.push(value);
        }
        return new Response(Buffer.concat(chunks), { headers: { "Content-Type": type, "Cache-Control": "private, max-age=300", "X-Content-Type-Options": "nosniff" } });
    } catch { return new Response("Could not load the image. Try again.", { status: 502 }); }
}
