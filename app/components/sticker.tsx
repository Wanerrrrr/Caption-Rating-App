export default function Sticker({ kind, className = "" }: { kind: "star" | "ghost" | "laugh"; className?: string }) {
    if (kind === "laugh") return <svg className={`sticker sticker-laugh ${className}`} viewBox="0 0 96 96" fill="none" aria-hidden="true" focusable="false">
        <circle cx="48" cy="48" r="38" fill="white" stroke="white" strokeWidth="12" />
        <circle cx="48" cy="48" r="38" fill="#fff0b9" stroke="#17152f" strokeWidth="2.8" />
        <path d="M26 39q7-11 14 0M56 39q7-11 14 0" stroke="#17152f" strokeWidth="3" strokeLinecap="round" />
        <path d="M29 49h38c-1 17-9 25-19 25S30 66 29 49Z" fill="#17152f" stroke="#17152f" strokeWidth="2" strokeLinejoin="round" />
        <path d="M32 51h32l-3 7H35Z" fill="white" />
        <path d="M37 69q11-13 22 0-11 8-22 0Z" fill="#f8b9d2" />
        <ellipse cx="23" cy="49" rx="5" ry="3" fill="#f8b9d2" /><ellipse cx="73" cy="49" rx="5" ry="3" fill="#f8b9d2" />
    </svg>;
    const shape = kind === "star"
        ? "M48 9 60 32 86 36 68 55 72 82 48 70 24 82 28 55 10 36 36 32Z"
        : "M20 75V39C20 18 32 9 48 9s28 9 28 30v36c0 8-8 9-12 3-5 8-12 8-16 0-5 8-12 8-16 0-5 6-12 5-12-3Z";
    return <svg className={`sticker sticker-${kind} ${className}`} viewBox="0 0 96 96" fill="none" aria-hidden="true" focusable="false">
        <path d={shape} fill="white" stroke="white" strokeWidth="12" strokeLinejoin="round" />
        <path d={shape} fill={kind === "star" ? "#fff0b9" : "#fffdfb"} stroke="#17152f" strokeWidth="2.8" strokeLinejoin="round" />
        <ellipse cx="35" cy="49" rx="3" ry="4" fill="#17152f" /><ellipse cx="59" cy="49" rx="3" ry="4" fill="#17152f" />
        <path d="M43 55q5 5 10 0" stroke="#17152f" strokeWidth="2" strokeLinecap="round" />
        <ellipse cx="29" cy="57" rx="5" ry="3" fill="#f8b9d2" /><ellipse cx="66" cy="57" rx="5" ry="3" fill="#f8b9d2" />
    </svg>;
}
