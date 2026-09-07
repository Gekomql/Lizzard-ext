/**
 * The control panel, and a live one.
 *
 * The animal in this popup is not a mock or a still: it is the same `mount()`
 * the content script calls, on this document, walking on the labels of the
 * settings you are changing. So if it works here it works on a page, and if you
 * turn it off here it goes away here too.
 */

import { DEFAULTS, allowedOn, getSettings, setSettings } from "../shared/settings.js";
import * as lizard from "../tools/lizard/index.js";

const $ = (id) => document.getElementById(id);

const fields = {
  enabled: $("enabled"),
  site: $("site"),
  name: $("name"),
  thoughts: $("thoughts"),
  debug: $("debug"),
  openTasks: $("openTasks"),
  inbox: $("inbox"),
  agents: $("agents"),
  views: $("views"),
  projects: $("projects"),
};

/** The hostname of the tab behind this popup, or "" for a page with none. */
async function currentHost() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  try {
    return new URL(tab?.url ?? "").hostname;
  } catch {
    return "";
  }
}

const host = await currentHost();
let settings = await getSettings();

/* ------------------------------------------------------------- the panel */

function paint() {
  fields.enabled.checked = settings.enabled;
  fields.site.checked = !settings.mutedHosts.includes(host);
  fields.site.disabled = host === "";
  fields.name.value = settings.name;
  fields.thoughts.checked = settings.thoughts;
  fields.debug.checked = settings.debug;

  const w = settings.workspace;
  fields.openTasks.value = w.openTasks;
  fields.inbox.value = w.inbox;
  fields.agents.value = w.agents;
  fields.views.value = w.views;
  fields.projects.value = w.projects.join(", ");
  $("work").open = w.configured;

  $("where").textContent =
    host === ""
      ? "No site here. It works on http and https pages."
      : allowedOn(settings, host)
        ? `Walking on ${host}`
        : `Off on ${host}`;
}

/** Saves, and keeps the local copy in step so `paint` never lags a click. */
async function save(patch) {
  settings = { ...settings, ...patch, workspace: { ...settings.workspace, ...(patch.workspace ?? {}) } };
  await setSettings(patch);
  paint();
}

fields.enabled.addEventListener("change", () => save({ enabled: fields.enabled.checked }));

fields.site.addEventListener("change", () => {
  if (host === "") return;
  const muted = new Set(settings.mutedHosts);
  if (fields.site.checked) muted.delete(host);
  else muted.add(host);
  save({ mutedHosts: [...muted] });
});

fields.name.addEventListener("change", () => save({ name: fields.name.value.trim() }));
fields.thoughts.addEventListener("change", () => save({ thoughts: fields.thoughts.checked }));
fields.debug.addEventListener("change", () => save({ debug: fields.debug.checked }));

/**
 * The numbers.
 *
 * `configured` flips true the moment you enter anything at all, and that is the
 * flag the voice checks before it is allowed to quote a count. Clearing them
 * all again puts it back to saying nothing about your work.
 */
const number = (el) => Math.max(0, Math.min(999, Number(el.value) || 0));

function saveWork() {
  const projects = fields.projects.value
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const workspace = {
    openTasks: number(fields.openTasks),
    inbox: number(fields.inbox),
    agents: number(fields.agents),
    views: number(fields.views),
    projects,
  };
  workspace.configured =
    workspace.openTasks > 0 ||
    workspace.inbox > 0 ||
    workspace.agents > 0 ||
    workspace.views > 0 ||
    projects.length > 0;
  return save({ workspace });
}

for (const el of [fields.openTasks, fields.inbox, fields.agents, fields.views, fields.projects]) {
  el.addEventListener("change", saveWork);
}

$("forget").addEventListener("click", () => save({ workspace: { ...DEFAULTS.workspace } }));

paint();

/* ----------------------------------------------------------- the preview */

/*
 * No shadow root here: this document is ours, the stylesheet is already linked
 * in the page, and keeping it in the light DOM means the animal measures the
 * labels above with the same Range it uses on a real page.
 */
lizard.mount({ shadow: false }).catch((err) => {
  console.warn("[lizard-extension] preview failed", err);
});
