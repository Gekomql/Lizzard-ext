/**
 * Every tool this extension puts on a page, and nothing else.
 *
 * This is the file you edit to add the next one. A tool is a module exporting
 * `id`, `name` and an async `mount()` that returns an `unmount()`; the loader
 * below neither knows nor cares what any of them draw.
 */

import * as lizard from "../tools/lizard/index.js";

export const TOOLS = [lizard];
