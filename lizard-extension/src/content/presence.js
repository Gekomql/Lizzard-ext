/**
 * Which tab has the animal.
 *
 * There is one lizard in the whole browser, not one per tab, and this is the
 * file that answers "is it this one?". Everything it needs is already known
 * somewhere; the work is in trusting the right source for each case.
 *
 *   - **A hidden tab never has it.** `document.hidden` is instant, local, and
 *     cannot be wrong, so switching tab inside a window needs no messaging at
 *     all: the tab you left knows immediately.
 *   - **Two visible tabs can exist**, one per window. Both would happily claim
 *     it. Only the background worker knows which window you are actually
 *     looking at, so a tab that becomes visible asks rather than assumes.
 *
 * It is written to fail towards being present. If the worker is asleep, gone,
 * or was never there — the harness stubs a `chrome` with no messaging at all —
 * a visible page keeps its lizard rather than losing it to a broken pipe.
 */

import { HOLDER, WHO } from "../shared/messages.js";

/** The popup is not a tab and is never in the running. Its animal is its own. */
const isExtensionPage = location.protocol === "chrome-extension:";
const canAsk = () => {
  try {
    return typeof chrome !== "undefined" && typeof chrome.runtime?.sendMessage === "function";
  } catch {
    return false;
  }
};

/**
 * Call `onChange(true|false)` whenever this page gains or loses the animal.
 *
 * Fires once shortly after being called with the current answer, and then only
 * on changes. Returns the usual unsubscribe.
 */
export function watchPresence(onChange) {
  if (isExtensionPage) {
    onChange(true);
    return () => {};
  }

  let current = null;
  let live = true;

  const set = (holds) => {
    if (!live || holds === current) return;
    current = holds;
    onChange(holds);
  };

  const ask = async () => {
    if (document.hidden) return set(false);
    if (!canAsk()) return set(true);
    try {
      const reply = await chrome.runtime.sendMessage({ type: WHO });
      set(Boolean(reply?.holds));
    } catch {
      // No worker listening. A visible page keeps the animal rather than
      // losing it to a pipe that is not there.
      set(true);
    }
  };

  const onVisibility = () => (document.hidden ? set(false) : ask());
  // A tab told it has the animal while hidden is a race — the worker answered
  // about a moment that has already passed. What is on screen wins.
  const onMessage = (msg) => {
    if (msg?.type === HOLDER) set(Boolean(msg.holds) && !document.hidden);
  };

  document.addEventListener("visibilitychange", onVisibility);
  window.addEventListener("focus", ask);
  if (canAsk()) chrome.runtime.onMessage.addListener(onMessage);
  ask();

  return () => {
    live = false;
    document.removeEventListener("visibilitychange", onVisibility);
    window.removeEventListener("focus", ask);
    if (canAsk()) chrome.runtime.onMessage.removeListener(onMessage);
  };
}
