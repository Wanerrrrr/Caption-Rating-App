export function hasCompleteName(profile: { first_name: string | null; last_name: string | null } | null) {
    return Boolean(profile?.first_name?.trim() && profile?.last_name?.trim());
}
