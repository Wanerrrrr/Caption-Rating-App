"use client";

import Image from "next/image";
import { useState, type CSSProperties } from "react";

export default function CaptionPhoto({ src, alt }: { src: string; alt: string }) {
    const [failed, setFailed] = useState(false);
    const [ratio, setRatio] = useState(4 / 3);
    return <div className="caption-photo" style={{ "--image-ratio": ratio } as CSSProperties}>
        {failed ? <span className="photo-unavailable">Photo unavailable</span> :
            <Image src={src} alt={alt} width={900} height={675} unoptimized
                onLoad={(event) => {
                    const image = event.currentTarget;
                    if (image.naturalHeight) setRatio(image.naturalWidth / image.naturalHeight);
                }} onError={() => setFailed(true)} />}
    </div>;
}
