"use client";

import { useActionState } from "react";
import { signOut } from "../auth/actions";

export default function SignOutButton() {
    const [state, action, pending] = useActionState(signOut, { error: "" });
    return <form className="signout-control" action={action}>
        <button className="signout-button" type="submit" disabled={pending}>{pending ? "Signing out…" : "Log Out"}</button>
        {state.error && <p role="alert">{state.error}</p>}
    </form>;
}
