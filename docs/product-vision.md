# Our Show — product vision and family viewing use cases

**Find something we all want to watch.**

## Current direction · November 23, 2026

Use this section when moving between design, planning, and implementation. The README describes the shipped app under its earlier name, *Our TV Show Shelf*. The flows below describe the intended next release.

### From a new household to a first pick

1. Ask “Where do you watch?” at the household level. Prime Video, Netflix, Paramount+, and YouTube are examples from the founding household. Service selection helps narrow browsing. Viewing history and subscription verification are separate capabilities.
2. Let families recognize shows by their artwork, tap to add them, or search for a title they already know. They can start with a handful and add more over time. “Add to our shows” records a familiar option. Each viewer’s interest, ratings, and viewing history need their own evidence.
3. Treat a YouTube channel as a pick in its own right. Choosing a channel can settle the family decision before anyone picks an individual video.
4. Open **Tonight** to a manageable set of familiar options for the people watching. When current favorites divide the room, bring an older, unfinished show back into view. Use “Let’s watch” to choose and “Not tonight” to pass. Allow a show to return on a later night.
5. Keep **Try something new** as a distinct discovery path for families who want it. The next design round can explore how to find an unseen show, try it now, or save it for later.

### Interaction details and unresolved choices

- **Artwork gallery.** When multiple images are available, swipe the image itself. Center one small pagination dot per image below it and highlight the active position. Omit dots for a single image. Expose the position to screen readers, for example “Image 2 of 3.”
- **Who is watching.** The example household has two children. Wording and logic need to work for other group sizes. Base claims of shared interest on the participating viewers’ known preferences. Keep unknown preferences visible as uncertainty.
- **Split votes.** The mockups explore ways to remember who wanted a passed show. The reminder interaction, copy, and timing remain open. The first implementation can test the family pick without introducing a fixed cooldown or a vote threshold.
- **Availability.** Catalog and channel sources, regional coverage, and how to label uncertain availability remain implementation questions. Preserve existing profiles, ratings, watch states, and JSON backups as the shelf evolves.

### First couch test

Start with an empty shelf. Can a parent and kids gather a few familiar options without typing their whole list? Then try Tonight on an evening when the kids want different shows. Does a suggestion prompt “Oh yeah, I forgot about that one” and help them choose before the parent supplies a compromise? Record which step required help and whether the family actually chose a show.

## Why this product exists

Our TV Show Shelf began immediately after a familiar family situation: two kids each had a different show in mind, neither agreed with the other, and a parent tried to suggest shows that could be acceptable compromises.

The original app helped keep track of shows and ratings. The deeper problem it should solve is **helping the family quickly agree on something they can actually watch together**.

### Purpose

Help a family find an appealing, available show to watch together with minimal negotiation, browsing, or effort.

### Product promise

**“What should we watch together?”** The app helps a parent—or interested kids—find a good shared option, especially when their first choices conflict.

### What success looks like

- A normal viewing decision takes seconds, not an extended debate.
- The parent can offer a short, credible set of compromise options that neither kid strongly dislikes.
- Recommendations account for shows the family can actually access through its streaming services.
- Familiar favorites are easy to return to, but overplayed favorites needn't dominate every suggestion.
- Discovery of new shows is available when the family has more time and interest, without slowing down quick everyday decisions.

These are qualitative goals; specific metrics should be decided later.

## Who uses it

- **Primary operator:** The parent, typically helping both kids choose together.
- **Potential direct users:** The kids may use the interface themselves if interested. Aim for a kid-friendly, understandable experience without assuming independent child accounts or complex parental controls.
- **Default context:** Both kids are watching together more often than not. Individual preferences remain important because they determine which choices can work for the group.

## What we've learned about actual family behavior

1. **Familiar shows dominate.** Returning to familiar shows is somewhat more common than beginning something new. “Continue watching” generally means returning to a familiar series, not necessarily resuming a precise episode.
2. **Novelty is occasional.** Discovering something new happens less often—perhaps on a Saturday night or a relaxed Sunday.
3. **Preferences ebb and flow.** Both kids may enjoy the same show for a streak, then tire of it temporarily and want a change. Temporary fatigue does not mean they permanently dislike the show.
4. **Disagreement starts with two specific requests.** When they cannot agree, each child often names one show they want. The parent then proposes alternative shows that might work as a compromise.
5. **The shelf supports the decision.** Adding, organizing, rating, and discovering shows are useful primarily because they improve the shared watch decision.
6. **Availability matters.** A recommendation is not actionable if the family cannot stream it through a service they have.

## Primary user journeys

### 1. Quick pick from familiar shows — everyday / primary

**Trigger:** It is time to watch something. The family wants a fast answer and may not have strong initial preferences.

**Desired flow:**
1. Open directly into a clear **“What should we watch?”** experience.
2. See a few familiar, currently plausible shared choices, ideally available through the family's services.
3. Choose one, or ask for another option.
4. Optionally mark **“Not tonight”** to skip a suggestion for the current selection session without changing long-term preference.

**UX implications:** Minimal steps, recognizable posters/titles, few high-confidence recommendations, large touch targets. The user should not have to manage collection data or select a profile before getting a family suggestion.

### 2. Find a compromise — core origin story

**Trigger:** Kid A wants one show; Kid B wants another.

**Desired flow:**
1. Choose **“Find a compromise”** (or equivalent).
2. Optionally indicate the two requested shows; this must not become a mandatory step for every session.
3. Present a short list of shows with a reasonable chance of satisfying **both** kids, not merely the highest arithmetic average.
4. Let the family reject an option for **tonight** and see another.
5. Keep the parent in control of the final suggestion and decision.

**Recommendation principle:** If one child loves a show and the other strongly dislikes it, a middle-of-the-road average can be misleading. Avoid interpreting a single averaged score as shared enthusiasm.

### 3. Discover something new — occasional / secondary

**Trigger:** The family has time and wants a new show, particularly on a weekend.

**Desired flow:**
1. Browse or search shows outside the existing shelf.
2. See title, image, a useful description, and **where it can be streamed**.
3. Prefer or filter to services the family subscribes to; optionally view wider options.
4. Save promising shows to **Want to try**, without confusing “haven't seen it” with “don't like it.”
5. Preserve each kid's preferences and the existing shelf.

**Note:** An external catalog, such as TMDB, is a candidate. Watch-provider data, regional coverage, streaming vs. rental/purchase distinctions, and API-key security must be evaluated before implementation.

### 4. Maintain the shelf and preferences — supporting journey

**Trigger:** A child liked/disliked something, the family finds a new show, or a parent needs to tidy the collection.

**Desired flow:**
1. Quickly add or find a show, ideally through catalog type-ahead with manual entry fallback.
2. Capture a simple expression of each child's preference.
3. Keep watch state separate from liking the show.
4. Adjust a preference over time without losing the show.
5. Manage profiles, streaming subscriptions, backups, and removals in less prominent but accessible areas.

## Preferences are not the same as tonight's choice

The current app uses 1–5 stars and watch status. We should **reconsider the visible rating interaction**, but not discard or automatically rewrite existing star data until a migration strategy is agreed.

Three distinct concepts may need representation:

- **Longer-term preference:** Does this kid like the show and generally want to return to it? Candidate UI: **Love it / It's okay / No thanks**, or a simpler thumbs-up/down choice. **Not decided yet.**
- **Temporary mood:** Would the kid watch it **tonight**? A proposed “Not tonight” action should affect the current selection session, not permanently lower a rating.
- **Viewing history/state:** Has the family tried it, is it a familiar favorite, or is it something they want to try? This should not be conflated with preference or require episode-level progress tracking.

Treat **unknown/unrated** as distinct from **disliked**. Allow preferences to change. Consider temporarily downranking frequently suggested or recently watched shows, but avoid implementing complicated cooldown or episode tracking prematurely.

## Streaming availability

**Proposed family-level setting:** Parent selects streaming services the household can access. This is not a per-kid preference.

**Use availability in:**
- **Quick picks and compromises:** Prefer or filter to shows watchable through subscribed services.
- **Catalog search:** Clearly show where a matching title can be watched before adding it.
- **Discovery:** Filter to accessible services by default or offer a clear toggle to broaden results.

**Important open questions:** Country/region, when provider data was last updated, handling unavailable/unknown availability, distinguishing included-with-subscription from renting/buying, and how to handle shows the family owns outside streaming. Do not promise authoritative live availability until a source is selected and tested.

## Earlier navigation ideas

These are starting points for a redesign, **not approved wireframes**:

- **Home: “What should we watch?”** Family-first. Quick pick and compromise prominent; familiar, available candidates.
- **Discover:** More deliberate search/browse workflow for finding and saving new shows.
- **Our shelf:** Manage shows, individual kid preferences, and watch state.
- **Settings:** Kid profiles, streaming services, JSON import/export, and other administrative controls.

Keep the parent workflow fast and make core actions understandable to kids. Avoid separate parent and child interfaces unless actual use demonstrates a need.

## Design principles

1. **Optimize for agreement, not collection size.**
2. **A recommendation should be watchable, not just appealing.**
3. **Shared fit matters more than the average rating.**
4. **A temporary “no” isn't a permanent dislike.**
5. **Familiar first, discovery when invited.**
6. **Parent-led, kid-friendly.**
7. **Minimal friction:** avoid unnecessary data entry or configuration before a quick pick.
8. **Preserve existing data:** changes to ratings, profiles, or backups need explicit compatibility/migration work.
9. **Keep the app simple:** no need for an elaborate streaming platform or episode-tracking system.

## Decisions to make later

- Exact preference scale and how old star ratings map (or don't map) to it.
- Whether compromise mode requires explicit competing shows or simply proposes shared alternatives.
- Whether “Not tonight” lasts for a single session or longer.
- How to incorporate recent viewing without full episode tracking.
- Streaming availability provider, regional accuracy, subscription settings, and treatment of unknown titles.
- Whether to add explicit fairness/turn-taking when no compromise is available.
- Any need for separate kid-facing mode or permissions.

---

_This document captures the product intent discussed with the parent. Proposed flows and recommendation behaviors are design hypotheses until reviewed and tested._
