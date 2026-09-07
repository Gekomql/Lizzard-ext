/**
 * The lizard, packaged as a tool.
 *
 * Every tool in this extension exposes the same three things — an id, a name,
 * and a `mount()` that returns an `unmount()`. The content script knows nothing
 * else about any of them, which is what makes adding the next one a matter of
 * writing a folder and adding a line to `src/content/tools.js`.
 */

import { watchPresence } from "../../content/presence.js";
import { getSettings, onSettingsChanged } from "../../shared/settings.js";
import { factsFrom } from "./facts.js";
import { createLizard, isWelcome, watchWelcome } from "./lizard.js";

export const id = "lizard";
export const name = "Lizard";

const SHEET = "src/tools/lizard/lizard.css";

/** The stylesheet, fetched once per document and shared by every mount. */
let sheetText = null;
async function styles() {
  if (sheetText === null) {
    const res = await fetch(chrome.runtime.getURL(SHEET));
    sheetText = await res.text();
  }
  return sheetText;
}

/**
 * Put the animal on a document.
 *
 * `host` is where the layer goes. Passing `shadow: true` wraps it in a shadow
 * root with its own copy of the stylesheet, which is how it behaves on somebody
 * else's website: no rule of ours can reach their page, and no rule of theirs
 * can reach our bubble.
 */
export async function mount({ doc = document, shadow = true } = {}) {
  const css = await styles();
  let settings = await getSettings();

  const container = doc.createElement("div");
  container.dataset.lizardExtension = "";
  // Its own stacking context, and nothing inherited from whatever it landed in.
  container.style.cssText = "all: initial; position: static;";

  let scope;
  if (shadow) {
    const root = container.attachShadow({ mode: "open" });
    const style = doc.createElement("style");
    style.textContent = css;
    scope = doc.createElement("div");
    scope.className = "lz-scope";
    root.append(style, scope);
  } else {
    container.className = "lz-scope";
    scope = container;
  }
  doc.body.append(container);

  const view = doc.defaultView;
  let animal = null;
  /** Whether this page is currently the one page that has the animal. */
  let holds = false;

  const build = () => {
    if (animal || !holds || !isWelcome(view)) return;
    animal = createLizard({
      host: scope,
      doc,
      debug: settings.debug,
      thoughts: settings.thoughts,
      // Read fresh for every thought, so changing your name in the popup takes
      // effect on the next thing it says rather than on the next page load.
      getFacts: () => factsFrom(settings),
      // It is never dropped onto a page. It comes up out of the floor, because
      // wherever it was a second ago, it was somewhere else.
      entrance: "hole",
    });
  };

  const stop = () => {
    animal?.destroy();
    animal = null;
  };

  /*
   * Losing the animal is not the same as being switched off.
   *
   * A page you have merely navigated away from keeps its lizard, underground,
   * so coming back is it climbing out rather than a new one being built. A page
   * that is not welcome to it at all — reduced motion, a window too narrow —
   * gets it taken away properly.
   */
  const sync = () => {
    if (!isWelcome(view)) return stop();
    if (!holds) return animal?.leave();
    if (animal) animal.arrive();
    else build();
  };

  const unwatchWelcome = watchWelcome(view, sync);
  const unwatchPresence = watchPresence((next) => {
    holds = next;
    sync();
  });

  // Two settings are read once when the loop is built rather than every frame,
  // so changing either restarts the animal. Everything else is picked up live.
  const unwatchSettings = onSettingsChanged(async () => {
    const next = await getSettings();
    const restart = next.debug !== settings.debug || next.thoughts !== settings.thoughts;
    settings = next;
    if (restart) {
      stop();
      sync();
    }
  });

  sync();

  return function unmount() {
    unwatchWelcome();
    unwatchPresence();
    unwatchSettings();
    stop();
    container.remove();
  };
}
