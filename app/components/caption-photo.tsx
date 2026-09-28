"use client";

import Image from "next/image";
import { useState } from "react";

export default function CaptionPhoto({ src, alt }: { src: string; alt: string }) {
    const [failed, setFailed] = useState(false);
    return <div className="caption-photo">
        {failed ? <span className="photo-unavailable">Photo unavailable</span> :
            <Image src={src} alt={alt} width={900} height={675} unoptimized
                onError={() => setFailed(true)} />}
    </div>;
}
