import { redirect } from "next/navigation";

export default function Liked() {
    redirect("/explore?liked=1");
}
