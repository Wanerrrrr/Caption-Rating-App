export function hasCompleteProfile(profile: { first_name: string | null; last_name: string | null; nickname: string | null } | null) {
    return Boolean(profile?.first_name?.trim() && profile?.last_name?.trim() && profile?.nickname?.trim());
}
