# Our TV Show Shelf

Our TV Show Shelf is a shared TV-show collection for a family. Two kids can keep track of shows, rate them independently, and use those ratings to decide what to watch.

The app is intentionally starting with a simple, browser-based experience. The longer-term goal is to turn the shelf into a personalized TV discovery tool that can recommend shows the family has not added yet.

## What the app does today

- **Build a show collection:** Add TV shows with a title and category (Animation, Adventure, Comedy, Educational, Nature, Fantasy, or Other).
- **Rate shows individually:** Two people can each give a show a 1–5 star rating. The displayed average includes only ratings that have been entered.
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
- Learn from each kid's ratings and preferences.
- Discover worthwhile shows that are not already on the shelf.
- Make recommendations understandable by showing why a show might be a good fit.

The plan is incremental: preserve the existing collection and rating workflow while adding discovery capabilities.

## Roadmap

### Phase 1 — External show discovery

Add a **Discover** experience backed by a TV catalog such as [TMDB](https://www.themoviedb.org/). The first version should focus on practical discovery:

- Browse popular or discoverable TV shows outside the existing shelf.
- Filter discovery results by genre.
- Display useful show details such as title, poster, overview, and catalog rating.
- Avoid recommending shows that are already in the collection.
- Add a discovered show to the shelf without losing or changing existing ratings.

**API-key note:** A key embedded directly in client-side HTML can be viewed by visitors. For a more durable deployment, route catalog requests through a small serverless/backend function and keep secrets there. The integration approach will be chosen with the deployment environment in mind.

### Phase 2 — Personalized recommendations

Use the existing two-person ratings and watch statuses to make discovery more relevant. Explore recommendations based on shared family favorites as well as each kid's individual tastes, and tune the results using feedback from actual use.

### Phase 3 — Recommendation explanations and AI enhancements

Consider adding natural-language explanations for recommendations—for example, pointing out shared genres, themes, or preferences reflected in the ratings. AI is an optional enhancement, not a prerequisite for the initial discovery feature.

## Guiding principle

Build in small, testable increments. Keep the existing shelf, ratings, and picker working; introduce external discovery first; then make recommendations more personal as the app and its data mature.
