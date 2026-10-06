import Link from "next/link";
import SignOutButton from "./sign-out-button";
import Icon from "./ui-icon";
import Sticker from "./sticker";
import ProfileSummary, { type FrameProfile } from "./profile-summary";

export default function SiteFrame({ children, active, profile, searchQuery = "" }: {
    children: React.ReactNode;
    active: "profile" | "login" | "captions" | "create" | "explore";
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
                    <Link className="rail-item" href="/" aria-current={active === "captions" ? "page" : undefined}><Icon name="home" /><span>Home</span></Link>
                    <Link className="rail-item" href="/explore" aria-current={active === "explore" ? "page" : undefined}><Icon name="explore" /><span>Explore</span></Link>
                    <button className="rail-item" disabled title="Liked captions — coming soon"><Icon name="saved" /><span>Liked<small>Coming soon</small></span></button>
                    <Link className="rail-item profile-nav" href="/profile" aria-current={active === "profile" ? "page" : undefined}><Icon name="user" /><span>Profile</span></Link>
                </nav>
                <div className="rail-bottom"><SignOutButton /></div>
                </div>
            </aside>}
            <div className={`center-panel${(active === "captions" || active === "explore") ? " feed-panel" : ""}`}>
                <header className="site-header">
                    {!signedIn && <Link href="/" className="wordmark" aria-label="Caption Club home"><span>caption<span className="brand-second">club.</span></span></Link>}
                    {signedIn && <Link className="pill-button create-link" href="/create" aria-current={active === "create" ? "page" : undefined}><Icon name="plus" /><span>Create</span></Link>}
                    {signedIn && <form className="header-search" role="search" action="/explore" method="get">
                        <button className="search-submit" type="submit" aria-label="Search" disabled={!signedIn}><Icon name="search" /></button>
                        <input key={searchQuery} type="search" name="q" aria-label="Search captions and images" placeholder="Search captions / images…" defaultValue={searchQuery} maxLength={200} disabled={!signedIn} />
                    </form>}
                </header>
                <main id="main-content" className="site-main" tabIndex={-1}>{children}</main>
            </div>
            {signedIn && <aside className="profile-sidebar" aria-label="Your profile and achievements">
                <Sticker kind="ghost" className="profile-sticker" />
                <ProfileSummary profile={profile} />
                <Link className="profile-edit" href="/profile">My profile <Icon name="arrow" /></Link>
                <section className="sidebar-section"><div className="section-heading"><h3 className="folder-tab">Level & stats</h3><span className="coming-soon">Coming soon</span></div><div className="future-level"><span className="feature-icon"><Icon name="user" /></span><p>Your story starts here.<small>Your level and activity will live here.</small></p></div></section>
                <section className="sidebar-section"><div className="section-heading"><h3 className="folder-tab">Achievements</h3><span className="coming-soon">Coming soon</span></div><p className="sidebar-description">Little moments, worth celebrating.</p><div className="achievement-preview"><span className="feature-icon mint"><Icon name="award" /></span><div><strong>First vote</strong><small>Coming soon</small></div><Icon name="lock" /></div><div className="achievement-preview"><span className="feature-icon yellow"><Icon name="award" /></span><div><strong>10 ratings</strong><small>Coming soon</small></div><Icon name="lock" /></div></section>
            </aside>}
        </div>
    </div>;
}
