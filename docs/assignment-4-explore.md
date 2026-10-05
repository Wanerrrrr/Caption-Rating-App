# Explore

Explore keeps the shared navigation, profile sidebar, Create button and keyword search. The center contains theme buttons, a Filter menu and a vertically scrolling masonry feed. Desktop uses three equal-width columns; phones use two columns. Images and GIFs retain their proportions and cards adapt to their content. Home keeps its horizontal gallery.

## How themes work

This first version uses ordinary keyword matching against caption, image description and image alt text. A caption can belong to several themes. The rules are in `lib/explore.ts`; this is not semantic search or an AI classifier. Themes without matching posts show an empty state. College Life includes the existing classroom/assignment posts. Users do not select a theme during publishing yet.

## Sorting and likes

Filter supports newest, oldest, most liked and least liked. Equal like totals use newest first, then descending ID. Equal timestamps use ID in the same direction as time. The browser changes theme/sort without another database query and resets the feed to its beginning.

`captions.like_count` contains the total of positive votes, including zero for captions without likes. A private database trigger maintains it on vote insert/change/delete, with existing counts backfilled. It exposes no voter identities and adds no permissions to vote rows. Browser users cannot insert or update this count or call the internal trigger function.

After a successful like, Explore refreshes the server data so sorting uses the actual count. Generation and voting invalidate both Home and Explore. Existing authentication, duplicate vote handling and RLS remain in place.

## Files

- `app/explore/page.tsx`: authenticated data loading, paged around the API row limit.
- `app/explore/explore-gallery.tsx`: themes, hover/click Filter menu, gallery and empty state.
- `lib/explore.ts`: matching and four sorting rules.
- `docs/explore-like-counts.sql`: reference for the applied database migration.
- `app/components/site-frame.tsx`: Explore navigation link and active state.
- `app/globals.css`: responsive Explore styling.

## Validation

- Code lint and production build.
- Sorting tests including equal timestamps, equal counts and input immutability; caption/description keyword matches and word boundaries.
- Database counts reconciled against vote rows. Trigger insert, duplicate rejection, positive-to-negative changes and deletion tested inside rolled-back transactions.
- Authenticated insert triggers the counter; vote RLS remains owner-only; counter writes and internal function execution remain forbidden.
- Browser tests: four sorts, Food and empty Columbia themes, View all, hover/click menu, Escape, desktop and phone layouts, no document overflow, three equal-width masonry columns, natural photo proportions and contained vertical scrolling.

Try: Explore → Food → All → Filter → Oldest / Most liked. A keyword category can match image descriptions even when the caption omits its keyword.

## Keyword search

The shared header submits a GET form to `/explore?q=...` with Enter or the magnifying glass. The page reads the asynchronous search parameters, normalizes whitespace and limits queries to 200 characters. Results retain the masonry feed, themes and four sorts, show a result count, and offer Clear. Unmatched queries show an empty state.

Search matches literal, case-insensitive substrings in caption and image description. Every whitespace-separated term must occur somewhere across those two fields. It uses neither semantic search nor a new database query or permission. Image alt text still participates in theme classification, but is not part of keyword search. Search URLs can be reloaded and shared; submitting a new search starts with All and Newest. This first version uses the existing paged caption loading, so a much larger collection would benefit from database-side search and pagination.

Verified description-only `dogs` finds caption 16, mixed-field `SYLLABUS dogs` works, unmatched search shows its empty state, Clear restores all 11 captions, and the phone layout has no page overflow. Matching checks cover case, spaces, multiple terms, null descriptions, literal punctuation, theme intersection and input immutability. Lint and production build passed.
