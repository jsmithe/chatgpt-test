# Our TV Show Shelf

Our TV Show Shelf is a family-managed TV-show collection. Family members can keep track of shows, rate them, and use those ratings to decide what to watch.

The app is starting with a simple browser-based experience. The longer-term goal is to evolve the shelf into a personalized TV discovery tool that helps the family choose from its collection and find shows it has not added yet.

## What the app does today

- **Build a show collection:** Add TV shows with a title and category (Animation, Adventure, Comedy, Educational, Nature, Fantasy, or Other).
- **Rate shows individually:** The current version supports ratings from two kids on a 1–5 star scale. The displayed average includes only ratings that have been entered.
- **Track watch status:** Mark a show as Unwatched, Watching, or Completed.
- **Pick something to watch:** Randomly choose an eligible show using a configurable minimum average rating. Completed shows are excluded.
- **Get collection-based suggestions:** Browse Family favorites, shows not rated by both kids, either kid's favorites, or Favorite categories. Choose how many suggestions to show.
- **Find and filter entries:** Search by title and filter the collection by category.
- **Back up and restore data:** Export the collection to JSON or import a JSON backup. The app can also load an initial collection from `shows.json`.

## Current data and implementation

The app is a client-side HTML, CSS, and JavaScript application. Collection data is saved in the browser's `localStorage`, so it is local to that browser/device; it is not currently synchronized through a shared database or account. JSON export/import provides a way to move or back up the collection. A `shows.json` file can provide initial data.

Recommendations today are based on shows already in the collection. The app does **not yet** fetch a catalog of new shows from an external service, and it does not currently support movies.

## Product goal

Evolve Our TV Show Shelf from a place to collect and rate shows into a personalized family TV discovery experience:

- Help the family choose something from its existing shelf.
- Make it fast to add a show by searching an external TV catalog and selecting a matching result.
- Let parents create and manage kid profiles, with each kid's own shows and ratings.
- Learn from each kid's ratings and preferences.
- Discover worthwhile shows that are not already on the shelf.
- Make recommendations understandable by showing why a show might be a good fit.

The plan is incremental: preserve the existing collection and rating workflow while adding discovery capabilities and moving from the current fixed two-kid setup to flexible profiles.

## Roadmap

### Phase 1 — TV catalog search and discovery

Integrate with an external TV catalog such as [TMDB](https://www.themoviedb.org/) to support both adding known shows and discovering new ones.

**Search and add shows**
- Provide type-ahead search as a parent types a show title.
- Show useful matching results, such as title, poster, release year, and overview.
- Let the parent select a result and populate available catalog details automatically.
- Keep kid selection and personal ratings under the app's control.
- Prevent duplicate entries and retain a manual-entry fallback when a show is not found.

**Discover shows**
- Browse popular or discoverable TV shows outside the existing shelf.
- Filter discovery results by genre.
- Display details such as title, poster, overview, and catalog rating.
- Exclude shows already in the collection where appropriate.
- Add a discovered show to the shelf without losing or changing existing ratings.

**API-key note:** A key embedded directly in client-side HTML can be viewed by visitors. For a more durable deployment, route catalog requests through a small serverless/backend function and keep secrets there. The integration approach will be chosen with the deployment environment in mind.

### Phase 2 — Flexible kid profiles

Replace the fixed two-kid setup with parent-managed profiles.

- Start with one kid profile by default.
- Allow a parent to add additional kids as needed, as well as edit profile names.
- Let the parent switch between kids' shelves.
- Associate each show's entry and rating with the relevant kid, so one kid's collection and ratings do not affect another's.
- Preserve existing collection data and migrate the current two-kid ratings carefully.
- Decide how to handle a profile's data if a kid is removed (for example, archive it or confirm deletion).

Profiles are family-managed within the app; individual kid logins are not part of this planned feature.

### Phase 3 — Personalized recommendations

Use each kid's ratings and watch status to make recommendations more relevant. Explore recommendations based on individual tastes as well as shared family favorites, and tune results using feedback from actual use. Flexible profiles from Phase 2 provide the data foundation for this work.

### Phase 4 — Recommendation explanations and optional AI

Consider adding natural-language explanations for recommendations—for example, pointing out shared genres, themes, or preferences reflected in a kid's ratings. AI is an optional enhancement, not a prerequisite for catalog search or the initial discovery experience.

## Guiding principle

Build in small, testable increments. Keep the existing shelf, ratings, and picker working; add catalog search and discovery; make kid profiles flexible; then make recommendations more personal as the app and its data mature.

Roadmap items describe planned work and should not be read as features already implemented.
