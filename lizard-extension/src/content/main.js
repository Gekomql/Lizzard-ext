/**
 * The content script proper.
 *
 * `loader.js` is a two-line stub whose only job is to import this, because a
 * content script declared in the manifest cannot itself be an ES module. From
 * here down everything is ordinary modules.
 *
 * What it does: mount every enabled tool, and take them all down again the
 * moment the popup says so, without needing the tab reloaded.
 */

import { allowedOn, getSettings, onSettingsChanged } from "../shared/settings.js";
import { TOOLS } from "./tools.js";

/** id → unmount. Present means running. */
const mounted = new Map();

/**
 * A frame is not a page.
 *
 * The content script runs in every iframe as well as the top document, and four
 * lizards walking over four ad frames is not the feature. Only the top one gets
 * an animal.
 */
const isTopFrame = window.top === window;

async function sync() {
  const settings = await getSettings();
  const on = isTopFrame && allowedOn(settings, location.hostname);

  for (const tool of TOOLS) {
    const running = mounted.get(tool.id);
    if (on && !running) {
      // Store the promise straight away, so a burst of storage events cannot
      // start the same tool twice while the first is still awaiting.
      const pending = tool.mount();
      mounted.set(tool.id, pending);
      pending.catch((err) => {
        mounted.delete(tool.id);
        console.warn(`[lizard-extension] ${tool.id} failed to mount`, err);
      });
    } else if (!on && running) {
      mounted.delete(tool.id);
      Promise.resolve(running).then((unmount) => unmount?.());
    }
  }
}

onSettingsChanged(sync);
sync();
