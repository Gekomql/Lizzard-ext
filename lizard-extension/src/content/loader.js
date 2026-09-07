/*
 * The only file the manifest names.
 *
 * A content script listed in a manifest is a classic script, so it cannot use
 * `import` at the top level. A dynamic import of an extension URL can, and
 * everything past this line is a normal module graph.
 *
 * It can also arrive twice: the manifest injects it when a page loads, and the
 * worker injects it by hand into tabs that were already open when the extension
 * was installed. A tab that gets both would import the same module twice, which
 * is harmless, but the flag says so out loud and costs nothing.
 */
if (!window.__lizardLoaded) {
  window.__lizardLoaded = true;
  import(chrome.runtime.getURL("src/content/main.js")).catch((err) => {
    console.warn("[lizard-extension] could not start", err);
  });
}
