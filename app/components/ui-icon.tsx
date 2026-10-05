export type IconName = "home" | "explore" | "saved" | "search" | "plus" | "user" | "lock" | "award" | "arrow" | "upload" | "filter" | "chevron";

export default function Icon({ name }: { name: IconName }) {
    const paths: Record<IconName, React.ReactNode> = {
        home: <><path d="m3 10 9-7 9 7" /><path d="M5 9v12h5v-7h4v7h5V9" /></>,
        explore: <><circle cx="12" cy="12" r="9" /><path d="m16 8-3 5-5 3 3-5 5-3Z" /></>,
        saved: <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z" />,
        search: <><circle cx="10.5" cy="10.5" r="6.5" /><path d="m16 16 5 5" /></>,
        plus: <path d="M12 5v14M5 12h14" />,
        user: <><circle cx="12" cy="8" r="4" /><path d="M4 21v-2a8 8 0 0 1 16 0v2" /></>,
        lock: <><rect x="5" y="10" width="14" height="11" rx="3" /><path d="M8 10V7a4 4 0 0 1 8 0v3M12 15v2" /></>,
        award: <><circle cx="12" cy="8" r="5" /><path d="m8 12-2 9 6-3 6 3-2-9" /></>,
        upload: <><path d="M12 16V3m-5 5 5-5 5 5" /><path d="M4 15v5a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-5" /></>,
        filter: <><path d="M4 6h16M7 12h10M10 18h4" /></>,
        chevron: <path d="m8 10 4 4 4-4" />,
        arrow: <path d="M5 12h14m-6-6 6 6-6 6" />,
    };
    return <svg className="ui-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>;
}
