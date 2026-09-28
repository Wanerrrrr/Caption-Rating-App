import Link from "next/link";
import SignOutButton from "./sign-out-button";

export default function SiteFrame({ children, active }: { children: React.ReactNode; active: "profile" | "login" | "captions" }) {
    return <div className="site-shell">
        <header className="site-header">
            <Link href="/" className="wordmark" aria-label="Caption Club home">caption<span>club</span><i>✳</i></Link>
            <nav aria-label="Main navigation"><Link href="/" aria-current={active === "captions" ? "page" : undefined}>The captions</Link><Link href="/profile" aria-current={active === "profile" ? "page" : undefined}>My profile</Link></nav>
            {active !== "login" && <SignOutButton />}
        </header>
        <main className="site-main">{children}</main>
        <footer className="site-footer"><Link href="/" className="footer-logo">Caption Club.</Link><span className="footer-flower" aria-hidden="true">✳</span></footer>
    </div>;
}
