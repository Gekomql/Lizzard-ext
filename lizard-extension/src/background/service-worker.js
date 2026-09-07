/**
 * The background worker.
 *
 * Three jobs, and it draws none of them: give the extension its defaults the
 * first time it is installed, keep the toolbar badge honest about whether the
 * animal is allowed on the site you are looking at, and decide which single tab
 * currently *has* the animal.
 *
 * That last one needs a worker rather than a content script. A page can tell
 * whether it is hidden, which is enough to know it has lost the lizard, but two
 * windows side by side both contain a visible tab and both would claim it. Only
 * out here is it knowable which window you are actually looking at.
 */

import { HOLDER, WHO } from "../shared/messages.js";
import { DEFAULTS, allowedOn, getSettings } from "../shared/settings.js";

chrome.runtime.onInstalled.addListener(async () => {
  const stored = await chrome.storage.sync.get(null);
  // Only fill in what has never been set. Re-writing every key on an update
  // would quietly undo your settings each time the extension is upgraded.
  const missing = {};
  for (const [key, value] of Object.entries(DEFAULTS)) {
    if (!(key in stored)) missing[key] = value;
  }
  if (Object.keys(missing).length > 0) await chrome.storage.sync.set(missing);
});

const hostOf = (url) => {
  try {
    return new URL(url).hostname;
  } catch {
    return "";
  }
};

async function paintBadge(tabId, url) {
  const settings = await getSettings();
  const on = allowedOn(settings, hostOf(url));
  await chrome.action.setBadgeText({ tabId, text: on ? "" : "off" });
  await chrome.action.setBadgeBackgroundColor({ tabId, color: "#3b2b18" });
}

chrome.tabs.onUpdated.addListener((tabId, info, tab) => {
  if (info.status === "complete" && tab.url) {
    paintBadge(tabId, tab.url);
    handOver();
  }
});

chrome.tabs.onActivated.addListener(async ({ tabId }) => {
  handOver();
  const tab = await chrome.tabs.get(tabId);
  if (tab.url) paintBadge(tabId, tab.url);
});

/* ------------------------------------------------------- who has the animal */

/**
 * The one tab holding it, as far as this worker knows.
 *
 * "As far as it knows" is doing real work in that sentence: the worker is
 * killed and restarted by the browser whenever it feels like it, and this goes
 * with it. That is survivable because it is only ever used to tell the
 * *previous* tab to let go, and a tab that has gone off screen already worked
 * that out for itself from `document.hidden`. Nothing depends on this
 * surviving; it only makes the hand-over prompt instead of eventual.
 */
let holder = null;

/** Only ordinary pages. The animal is not on a settings screen or a PDF. */
const isPage = (url) => /^https?:/.test(url ?? "");

const tell = (tabId, holds) => {
  if (tabId == null) return;
  // A tab with no content script in it — a page loaded before the extension
  // was, or one Chrome does not allow scripting — simply does not answer.
  chrome.tabs.sendMessage(tabId, { type: HOLDER, holds }).catch(() => {});
};

async function activeTabId() {
  const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
  return tab && isPage(tab.url) ? (tab.id ?? null) : null;
}

/** Take it off whoever had it, give it to whoever you are looking at now. */
async function handOver() {
  const next = await activeTabId();
  if (next === holder) return;
  const previous = holder;
  holder = next;
  tell(previous, false);
  tell(next, true);
}

chrome.windows.onFocusChanged.addListener((windowId) => {
  // Focusing something that is not a browser window at all — your editor, a
  // terminal — is not a reason to move the animal. It stays where it was.
  if (windowId !== chrome.windows.WINDOW_ID_NONE) handOver();
});

chrome.tabs.onRemoved.addListener((tabId) => {
  if (tabId === holder) {
    holder = null;
    handOver();
  }
});

/*
 * A page asking outright.
 *
 * This is the path that matters after the worker has been restarted, and after
 * a tab becomes visible in a window that may or may not be the one you are
 * looking at. The answer is recomputed from the browser rather than read from
 * `holder`, because `holder` is the thing that might have been lost.
 */
chrome.runtime.onMessage.addListener((message, sender, respond) => {
  if (message?.type !== WHO) return false;
  (async () => {
    const active = await activeTabId();
    holder = active;
    respond({ holds: sender.tab?.id != null && sender.tab.id === active });
  })();
  // Keeps the reply channel open across the await above.
  return true;
});

/*
 * Tabs that were already open when the extension was installed or reloaded.
 *
 * A content script declared in the manifest only runs when a page loads, so
 * every tab you already had open would sit there with no animal in it until you
 * reloaded it by hand. This is that reload, done for you, once.
 */
async function injectExisting() {
  const tabs = await chrome.tabs.query({ url: ["http://*/*", "https://*/*"] });
  await Promise.all(
    tabs.map((tab) =>
      tab.id == null
        ? null
        : chrome.scripting
            .executeScript({ target: { tabId: tab.id }, files: ["src/content/loader.js"] })
            // Chrome refuses on its own pages and on the extension gallery.
            // That is expected, and not worth a line in anybody's console.
            .catch(() => {}),
    ),
  );
  handOver();
}

chrome.runtime.onInstalled.addListener(injectExisting);
chrome.runtime.onStartup.addListener(handOver);

chrome.storage.onChanged.addListener(async (_changes, area) => {
  if (area !== "sync") return;
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab?.id && tab.url) paintBadge(tab.id, tab.url);
});
