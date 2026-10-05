import "server-only";
import sharp from "sharp";
import { DESCRIPTION_PROMPT } from "./gemini";

export const imageExtensions: Record<string, string> = {
    "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/gif": "gif",
};

export function matchesImage(bytes: Buffer, mime: string) {
    if (mime === "image/jpeg") return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
    if (mime === "image/png") return bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
    if (mime === "image/gif") return ["GIF87a", "GIF89a"].includes(bytes.toString("ascii", 0, 6));
    if (mime === "image/webp") return bytes.toString("ascii", 0, 4) === "RIFF" && bytes.toString("ascii", 8, 12) === "WEBP";
    return false;
}

export async function prepareDescriptionImage(bytes: Buffer, mime: string) {
    if (mime !== "image/gif") {
        return { descriptionPrompt: DESCRIPTION_PROMPT, images: [{ inline_data: { mime_type: mime, data: bytes.toString("base64") } }] };
    }
    try {
        const options = { limitInputPixels: 16_000_000, pages: 1 };
        const metadata = await sharp(bytes, options).metadata();
        const count = metadata.pages ?? 1;
        // Bound decoding work even for very small files with many compressed frames.
        if (count > 300) throw new Error("GIF_TOO_LONG");
        const indexes = [...new Set([0, Math.floor((count - 1) / 2), count - 1])];
        const images = [];
        for (const page of indexes) {
            const png = await sharp(bytes, { ...options, page })
                .resize({ width: 768, height: 768, fit: "inside", withoutEnlargement: true }).png().toBuffer();
            images.push({ inline_data: { mime_type: "image/png", data: png.toString("base64") } });
        }
        const descriptionPrompt = `${DESCRIPTION_PROMPT}\nThese ${images.length} images are ordered snapshots from the uploaded GIF, at frame indexes ${indexes.join(", ")} out of ${count} total frames (zero-based). Describe visible changes between the snapshots when present. Do not invent motion that is not visible in the sampled frames.`;
        return { descriptionPrompt, images };
    } catch (cause) {
        if (cause instanceof Error && cause.message === "GIF_TOO_LONG") {
            throw new Error("Choose a shorter GIF with no more than 300 frames.");
        }
        throw new Error("This GIF could not be read. Try another GIF up to 3 MB with frames no larger than 16 megapixels.");
    }
}
