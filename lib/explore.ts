export const themes = [
    { id: "all", label: "All", pattern: null },
    { id: "nyc", label: "NYC", pattern: /\b(nyc|new york|manhattan|brooklyn|subway|central park)\b/i },
    { id: "columbia", label: "Columbia", pattern: /\b(columbia|morningside|butler library|low library)\b/i },
    { id: "college", label: "College Life", pattern: /\b(college|university|student|professor|syllabus|assignment|lecture|class|classes|textbooks?|campus|deadline)\b/i },
    { id: "dorm", label: "Dorm Life", pattern: /\b(dorms?|dormitory|roommates?|laundry|bed|sleep|wi-fi)\b/i },
    { id: "midterms", label: "Midterms", pattern: /\b(midterms?|finals?|exams?|studying|study|textbooks?|homework)\b/i },
    { id: "food", label: "Food", pattern: /\b(food|fridge|refrigerator|pizza|coffee|restaurant|dining|meal|meals|cooking|snacks?)\b/i },
    { id: "weekend", label: "Weekend", pattern: /\b(weekends?|saturday|sunday|party|parties|museum|concert|brunch|park)\b/i },
] as const;

export type ThemeId = typeof themes[number]["id"];
export const sortOptions = [
    { id: "newest", label: "Newest" },
    { id: "oldest", label: "Oldest" },
    { id: "most-liked", label: "Most liked" },
    { id: "least-liked", label: "Least liked" },
] as const;
export type ExploreSort = typeof sortOptions[number]["id"];
export type ExploreCaption = {
    id: number;
    caption: string;
    image_url: string | null;
    image_alt: string | null;
    image_description: string | null;
    created_at: string;
    like_count: number;
    ownVote: 1 | -1 | null;
};

export function exploreCaptions(captions: ExploreCaption[], theme: ThemeId, sort: ExploreSort, query = "") {
    const pattern = themes.find(item => item.id === theme)?.pattern;
    const terms = query.normalize("NFKC").toLowerCase().trim().split(/\s+/).filter(Boolean);
    const filtered = captions.filter(item => {
        const themeText = [item.caption, item.image_description, item.image_alt].filter(Boolean).join(" ");
        const searchText = [item.caption, item.image_description].filter(Boolean).join(" ").normalize("NFKC").toLowerCase();
        return (!pattern || pattern.test(themeText)) && terms.every(term => searchText.includes(term));
    });
    const newest = (a: ExploreCaption, b: ExploreCaption) => Date.parse(b.created_at) - Date.parse(a.created_at) || b.id - a.id;
    return filtered.sort((a, b) => {
        if (sort === "oldest") return -newest(a, b);
        if (sort === "most-liked") return b.like_count - a.like_count || newest(a, b);
        if (sort === "least-liked") return a.like_count - b.like_count || newest(a, b);
        return newest(a, b);
    });
}
