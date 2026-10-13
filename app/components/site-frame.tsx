import Link from "next/link";
import SignOutButton from "./sign-out-button";
import Icon from "./ui-icon";
import Sticker from "./sticker";
import CommunitySidebar from "./community-sidebar";
import { type FrameProfile } from "./profile-summary";

export default async function SiteFrame({ children, active, profile, searchQuery = "" }: {
    children: React.ReactNode;
    active: "profile" | "login" | "captions" | "create" | "explore" | "post" | "me" | "member";
    profile?: FrameProfile | null;
    searchQuery?: string;
}) {
    const signedIn = active !== "login";
    return <div className={`site-shell${signedIn ? "" : " login-shell"}`}>
        <a className="skip-link" href="#main-content">Skip to content</a>
        <div className="dashboard-body">
            {signedIn && <aside className="navigation-rail">
                <div className="rail-content">
                <Link href="/" className="wordmark" aria-label="Caption Club home"><span>caption<span className="brand-second">club.</span></span></Link>
                <nav aria-label="Main navigation">
                    <Link className="rail-item" href="/explore" aria-current={active === "explore" ? "page" : undefined}><Icon name="explore" /><span>Explore</span></Link>
                    <Link className="rail-item" href="/create" aria-current={active === "create" ? "page" : undefined}><Icon name="plus" /><span>Create</span></Link>
                    <Link className="rail-item challenge-nav" href="/" aria-current={active === "captions" ? "page" : undefined}><Icon name="home" /><span>Challenge</span></Link>
                    <Link className="rail-item" href="/me" aria-current={active === "me" ? "page" : undefined}><Icon name="user" /><span>Me</span></Link>
                </nav>
                <div className="rail-bottom"><SignOutButton /></div>
                </div>
            </aside>}
            <div className={`center-panel${(active === "captions" || active === "explore" || active === "me" || active === "member") ? " feed-panel" : ""}`}>
                <header className="site-header">
                    {!signedIn && <Link href="/" className="wordmark" aria-label="Caption Club home"><span>caption<span className="brand-second">club.</span></span></Link>}
                    {signedIn && <form className="header-search" role="search" action="/explore" method="get">
                        <button className="search-submit" type="submit" aria-label="Search" disabled={!signedIn}><Icon name="search" /></button>
                        <input key={searchQuery} type="search" name="q" aria-label="Search captions and images" placeholder="Search captions / images…" defaultValue={searchQuery} maxLength={200} disabled={!signedIn} />
                    </form>}
                </header>
                <main id="main-content" className="site-main" tabIndex={-1}>{children}</main>
            </div>
            {signedIn && <aside className="profile-sidebar" aria-label="Your profile and achievements">
                <Sticker kind="ghost" className="profile-sticker" />
                <CommunitySidebar profile={profile} />
            </aside>}
        </div>
    </div>;
}
