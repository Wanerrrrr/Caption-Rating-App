export function formatPostTime(createdAt: string, now: Date = new Date()) {
    const date = new Date(createdAt);
    if (!Number.isFinite(date.getTime())) return "";
    const elapsed = Math.max(0, now.getTime() - date.getTime());
    const minutes = Math.floor(elapsed / 60_000);
    if (minutes < 1) return "Just now";
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
    const time = date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
    if (date < today && date >= yesterday) return `Yesterday, ${time}`;
    if (date >= today) {
        if (minutes < 60) return `${minutes} ${minutes === 1 ? "minute" : "minutes"} ago`;
        const hours = Math.floor(minutes / 60);
        return `${hours} ${hours === 1 ? "hour" : "hours"} ago`;
    }
    return `${date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: date.getFullYear() === now.getFullYear() ? undefined : "numeric" })}, ${time}`;
}
