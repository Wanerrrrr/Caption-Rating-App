// Caption above, white background, original image below. GIFs export as a still frame.
export async function makeShareImage(id: number, caption: string): Promise<Blob> {
    const response = await fetch(`/api/post/${id}/image`);
    if (!response.ok) throw new Error("Could not load the image. Please retry.");
    const source = URL.createObjectURL(await response.blob());
    try {
        const image = new Image();
        image.src = source;
        await image.decode();
        const width = 1080, padding = 56, fontSize = 40, lineHeight = 56;
        const canvas = document.createElement("canvas"), context = canvas.getContext("2d");
        if (!context) throw new Error("Image export is not supported in this browser.");
        context.font = `${fontSize}px Arial, sans-serif`;
        const lines: string[] = [];
        let line = "";
        for (const paragraph of caption.split(/\r?\n/)) {
            for (const word of paragraph.split(/\s+/).filter(Boolean)) {
                const candidate = line ? `${line} ${word}` : word;
                if (context.measureText(candidate).width > width - padding * 2 && line) { lines.push(line); line = ""; }
                for (const char of word) {
                    if (context.measureText(line + char).width > width - padding * 2) { lines.push(line); line = ""; }
                    line += char;
                }
                line += " ";
            }
            lines.push(line.trimEnd()); line = "";
        }
        const textHeight = padding * 2 + lines.length * lineHeight;
        const imageHeight = Math.min(1800, Math.round(width * image.naturalHeight / image.naturalWidth));
        canvas.width = width; canvas.height = textHeight + imageHeight;
        context.fillStyle = "white"; context.fillRect(0, 0, canvas.width, canvas.height);
        context.fillStyle = "#17152f"; context.font = `${fontSize}px Arial, sans-serif`; context.textBaseline = "top";
        lines.forEach((text, index) => context.fillText(text.trimEnd(), padding, padding + index * lineHeight));
        const scale = Math.min(width / image.naturalWidth, imageHeight / image.naturalHeight);
        const drawWidth = image.naturalWidth * scale, drawHeight = image.naturalHeight * scale;
        context.drawImage(image, (width - drawWidth) / 2, textHeight, drawWidth, drawHeight);
        return await new Promise<Blob>((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error("Image export failed.")), "image/png"));
    } finally { URL.revokeObjectURL(source); }
}
