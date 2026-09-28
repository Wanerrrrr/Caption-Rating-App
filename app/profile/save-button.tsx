"use client";

import { useFormStatus } from "react-dom";

export default function SaveButton() {
    const { pending } = useFormStatus();
    return <button className="pill-button" type="submit" disabled={pending}>{pending ? "Saving…" : "Save profile"}<span aria-hidden="true">↗</span></button>;
}
