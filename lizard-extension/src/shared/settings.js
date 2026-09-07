/**
 * Everything the extension remembers, in one place.
 *
 * `chrome.storage.sync` rather than `local` so the animal follows you between
 * machines signed into the same Chrome. Every read goes through `getSettings`
 * so a key added later has exactly one default.
 */

export const DEFAULTS = {
  /** The master switch. The popup's big toggle. */
  enabled: true,
  /** Sites it has been thrown off. Hostnames, no scheme. */
  mutedHosts: [],
  /** What to call you. Empty means it falls back to "you". */
  name: "",
  /**
   * Whether it is allowed to say anything.
   *
   * Off is strictly the animal: no bubble, no text, nothing but a lizard
   * walking on the page. The walking, hunting and burrowing are unaffected —
   * it simply keeps its opinions to itself.
   */
  thoughts: true,
  /** Compresses the schedule so burrowing and hunting are watchable. */
  debug: false,
  /**
   * Numbers you have chosen to tell it about your own work.
   *
   * `configured` stays false until you fill these in, and while it is false the
   * lizard will not say a single line that quotes a count. See `facts.js`.
   */
  workspace: {
    configured: false,
    openTasks: 0,
    inbox: 0,
    projects: [],
    agents: 0,
    views: 0,
  },
};

export async function getSettings() {
  const stored = await chrome.storage.sync.get(DEFAULTS);
  return {
    ...DEFAULTS,
    ...stored,
    workspace: { ...DEFAULTS.workspace, ...(stored.workspace ?? {}) },
  };
}

export async function setSettings(patch) {
  await chrome.storage.sync.set(patch);
}

/** Fires whenever anything above changes, in any tab or the popup. */
export function onSettingsChanged(handler) {
  const listener = (changes, area) => {
    if (area === "sync") handler(changes);
  };
  chrome.storage.onChanged.addListener(listener);
  return () => chrome.storage.onChanged.removeListener(listener);
}

/** Is the animal allowed on this hostname? */
export function allowedOn(settings, hostname) {
  return settings.enabled && !settings.mutedHosts.includes(hostname);
}
