import { createClient } from "@/lib/supabase/server";

export type PostAuthor = { nickname: string; avatar_url: string | null };
export async function withPostAuthors<T extends { created_by: string | null }>(supabase: Awaited<ReturnType<typeof createClient>>, posts: T[]) {
    const ids = [...new Set(posts.map(post => post.created_by).filter((id): id is string => Boolean(id)))];
    const authors = new Map<string, PostAuthor>();
    for (let start = 0; start < ids.length; start += 500) {
        const { data, error } = await supabase.from("post_authors").select("id,nickname,avatar_url").in("id", ids.slice(start, start + 500));
        if (error) throw new Error("Could not load post authors. Please refresh.");
        for (const author of data ?? []) authors.set(author.id, { nickname: author.nickname, avatar_url: author.avatar_url });
    }
    return posts.map(post => ({ ...post, author: post.created_by ? authors.get(post.created_by) ?? { nickname: "Member", avatar_url: null } : { nickname: "Caption Club", avatar_url: null } }));
}
