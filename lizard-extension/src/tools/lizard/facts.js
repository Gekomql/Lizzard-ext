/**
 * What the lizard is allowed to claim.
 *
 * In Lumen this file's counterpart reads the datastore that rendered the page:
 * real issue keys, real titles, real ages in days, nothing estimated, rounded
 * up for effect, or invented to fill a gap. The whole reason the animal is
 * allowed to be that rude is that it is never wrong.
 *
 * A browser extension has no datastore, and inventing one would be the same lie
 * in a smaller font. So the rule is carried over rather than dropped:
 *
 *   - Until you type real numbers into the popup, `configured` is false and the
 *     pool is `ambientLines` only — the clock and pure contempt, neither of
 *     which asserts anything about your work.
 *   - Once you have, the counting lines and the row-specific Lumen lines come
 *     back, quoting exactly the numbers you gave it and no others.
 *   - `pointers` — the named, dated nags — stay empty here, because nothing in
 *     a browser can observe a stale issue. No source, no claim.
 */

import { ambientLines, lizardLines } from "./lines.js";

/**
 * The knowledge object the voice and the loop both read.
 *
 * `pool` is precomputed because the general lines only change when the hour or
 * your settings do, and rebuilding fifty strings inside a thought is waste.
 */
export function factsFrom(settings, hour = new Date().getHours()) {
  const w = settings.workspace ?? {};
  const knowledge = {
    name: settings.name ?? "",
    configured: Boolean(w.configured),
    openTasks: Number(w.openTasks) || 0,
    inbox: Number(w.inbox) || 0,
    projects: Array.isArray(w.projects) ? w.projects.filter(Boolean) : [],
    agents: Number(w.agents) || 0,
    views: Number(w.views) || 0,
    // Nothing out here can observe a specific overdue thing, so it never names
    // one. An empty list is the honest answer, not a gap to fill.
    pointers: [],
    hour,
  };

  knowledge.pool = knowledge.configured ? lizardLines(knowledge) : ambientLines(knowledge);
  return knowledge;
}
