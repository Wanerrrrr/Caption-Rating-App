import "server-only";
import { createClient } from "@/lib/supabase/server";

export type Challenge = { id: string; title: string; theme: string; image_url: string | null; week_start: string; starts_at: string; ends_at: string; settled_at: string | null };
export type Credits = { weekly: number; bonus: number; total: number; resetsAt: string };
export function challengeTime() { return Date.now(); }
export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
type Client = Awaited<ReturnType<typeof createClient>>;
export async function getCredits(client: Client): Promise<Credits> {
    const { data, error } = await client.rpc("generation_balance");
    if (error) throw new Error("Unable to load your generation credits. Please refresh.");
    return data as Credits;
}
export function serverSecret() {
    const secret = process.env.CHALLENGE_SERVER_SECRET;
    if (!secret) throw new Error("Generation credits are not configured yet.");
    return secret;
}
export async function getChallenge(client: Client, id: string): Promise<Challenge | null> {
    if (!UUID.test(id)) return null;
    const { data, error } = await client.from("weekly_challenges").select("*").eq("id", id).maybeSingle();
    if (error) throw new Error("Unable to load this challenge.");
    return data;
}
export async function assertCanEnter(client: Client, challenge: Challenge, userId: string) {
    if (Date.now() < Date.parse(challenge.starts_at) || Date.now() >= Date.parse(challenge.ends_at) || challenge.settled_at) throw new Error("This challenge is not open.");
    const { data, error } = await client.from("challenge_entries").select("id").eq("challenge_id", challenge.id).eq("user_id", userId).maybeSingle();
    if (error) throw new Error("Unable to check your entry. Please refresh.");
    if (data) throw new Error("You already entered this challenge.");
}
// Only the app's own storage bucket may supply fixed challenge images.
export async function fixedChallengeImage(challenge: Challenge): Promise<File> {
    const url = new URL(challenge.image_url!);
    const base = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL!);
    if (url.origin !== base.origin || !url.pathname.startsWith("/storage/v1/object/public/caption-images/")) throw new Error("Invalid challenge image.");
    const response = await fetch(url, { redirect: "error", signal: AbortSignal.timeout(15_000), cache: "no-store" });
    if (!response.ok) throw new Error("The challenge image could not be loaded.");
    const mime = response.headers.get("content-type")?.split(";")[0] ?? "";
    if (!['image/jpeg','image/png','image/webp','image/gif'].includes(mime)) throw new Error("Invalid challenge image format.");
    const reader = response.body?.getReader();
    if (!reader) throw new Error("The challenge image could not be read.");
    const chunks: Uint8Array[] = []; let size = 0;
    while (true) {
        const { done, value } = await reader.read(); if (done) break;
        size += value.byteLength;
        if (size > 3 * 1024 * 1024) { await reader.cancel(); throw new Error("Challenge image exceeds 3 MB."); }
        chunks.push(value);
    }
    return new File([Buffer.concat(chunks)], "challenge-image", { type: mime });
}
export async function finishCredit(client: Client, id: string, success: boolean) {
    const { data, error } = await client.rpc("finish_generation", { p_generation_id: id, p_success: success, p_server_secret: serverSecret() });
    if (error) throw new Error("Unable to confirm your generation credits. Please refresh.");
    return data as Credits;
}
