# Lizard

A lizard that lives in your browser. It walks on the real words of whatever page
you are reading, hunts flies, digs holes and climbs back out somewhere else, does
push-ups, and has opinions about you.

It draws **nothing but the animal**. The layer it lives on is transparent and
takes no clicks at all, so the page underneath looks and behaves exactly as it
did.

## Where this came from

The animal was built inside [Lumen](../lumen) as a React component. This folder
is a copy-out, not a move: Lumen still has its own lizard and was not modified.
Nothing here imports anything from there, and nothing there imports anything from
here. The two are now separate animals with a common ancestor.

| Here | Came from | What changed |
|---|---|---|
| `src/tools/lizard/geometry.js` | `src/lib/lizard.ts` | TypeScript types removed. Nothing else. |
| `src/tools/lizard/lines.js` | `src/lib/lizard-lines.ts` | Split into ambient / workspace pools, plus `wordLine()` for pages it knows nothing about. |
| `src/tools/lizard/markup.js` | the JSX in `src/components/critter/lizard.tsx` | JSX to a markup string. Same nodes, same hooks, same paths. |
| `src/tools/lizard/lizard.js` | the `useEffect` in the same file | `useEffect` to `createLizard()`. The frame loop is unchanged. |
| `src/tools/lizard/lizard.css` | `src/app/globals.css`, lines 2523-2617 | The four inherited colour variables are declared here instead. |
| `src/tools/lizard/facts.js` | `src/lib/lizard-facts.ts` | Rewritten. There is no datastore in a browser, so see **What it will not say**. |

## What it will not say

In Lumen every number the animal quotes is read from the datastore that rendered
the page. It is allowed to be that rude because it is never wrong.

There is no datastore out here, so the rule is kept rather than dropped: until
you type real numbers into the popup, it will not say a single line that quotes a
count. It talks about the clock, the page, and you. Once you do fill them in, it
quotes exactly those numbers and no others, and it never names a specific issue,
review or deadline, because nothing in a browser can observe one.

## What it can see

The page itself turns out to be a perfectly good source of true things, so the
animal reads it and talks about it. `src/tools/lizard/page.js` measures, and
`src/tools/lizard/page-lines.js` is what it says about the measurements.

| It looks at | So it can say |
|---|---|
| The hostname | Jokes written for that site by name — YouTube, GitHub, Reddit, Wikipedia, Gmail, Amazon, Netflix, LinkedIn, Slack, Figma, `localhost` and about forty others |
| **What the page says it is** | `og:` meta tags and schema.org JSON-LD. A shop states that it is a product and gives the price; a recipe states its ingredients; an article states when it was written and by whom |
| **What the page is about** | Seventeen subjects — money, health, jobs, code, nature, history, sport, law and the rest — scored from the page's own headings and opening prose |
| The shape of the page | Whether this is an article, a video, a form, search results, a feed, code, or a dead 404 |
| About how many words are under it | "About 1,400 words below me. 6 minutes of reading. You have got 2 minutes in you." |
| The scrollbar | How far down you actually are, and how long you have been not moving |
| The `<video>` | Whether it is playing, and how far into it you are |
| The clock | How long you have been on this one page |

So on a shop it knows the price, on a recipe it knows the ingredient count, on
an article it knows the year and the author, and on the enormous majority of the
web that publishes none of that it works the subject out of the prose.

Every number in those lines was measured in your tab a moment ago. Nothing is
sent anywhere, nothing is stored, and the survey is done once per URL rather
than once per frame — about 20ms on a ten-thousand-word Wikipedia article.

**The one inference in the whole extension carries its evidence.** A subject
guessed from prose has to be hit by three separate words before it may claim the
page, and the line that uses it quotes what it found: *"The word 'species' is on
this page 4 times. I know exactly what this is, and so do you."* It is
describing what is written in front of it, which it can see, rather than
claiming to know what the page means, which it cannot. Where a page declares its
own type, that always wins over the guess.

An old page and an abandoned page are not the same thing, either. A wiki article
says it was published in 2001 and edited yesterday; both are true, and the line
it says is the second one.

**On a page with a password box on it, it says nothing about the page at all.**
What you are doing there is not the lizard's business, and a joke about it would
not be a joke.

## One lizard, not one per tab

There is a single animal in the whole browser and it lives in the tab you are
looking at. Switch tab and it digs down in the one you left and comes up out of
a hole in the one you arrived at, with something to say about the journey.

| Who knows what | How |
|---|---|
| "I am not the tab any more" | `document.hidden`. Instant, local, and it cannot be wrong |
| "I am the tab" | The worker is asked, because two windows side by side both contain a visible tab and both would otherwise claim it |
| Tabs open before the extension was loaded | The worker injects the content script into them once, so they do not need reloading by hand |

Leaving is not the same as being switched off. A page you have navigated away
from keeps its lizard, underground, and the hole collapses behind it — coming
back is it climbing out, not a new one being built.

`src/content/presence.js` is the page's half of that, and the worker is the
other half. This is also why the extension asks for **host access to all sites**
and the **scripting** permission: it has to be able to talk to the content
script in the tab you just left, and to reach tabs that were already open.

## Loading it

1. Open `chrome://extensions`.
2. Turn on **Developer mode**, top right.
3. Click **Load unpacked** and choose this folder,
   `~/Developer/lizard-extension`.
4. Open any ordinary web page. It appears within a second or two.

There is no build step and nothing to install. Editing a file and pressing the
reload arrow on the extension card is the whole development loop.

## The popup

Click the toolbar icon.

| Control | What it does |
|---|---|
| **Lizard** | The master switch. Off removes it everywhere, immediately, with no page reload. |
| **Allow on this site** | Throws it off the site you are looking at, and only that one. |
| **Your name** | What it calls you. Blank means "you". |
| **Let it talk** | Off is strictly the animal: no bubble, no text. It still walks, hunts and burrows. |
| **Debug timing** | Burrowing, hunting and nagging happen in seconds instead of minutes, and the state machine is published on `window.__critter`. Timing only, never behaviour. |
| **Tell it about your work** | The numbers above. Empty means it stays quiet about them. |

The animal walking around inside the popup is not a picture. It is the same
`mount()` the content script calls, so anything you change there you can watch
take effect on the spot.

## Layout

```
manifest.json                  Manifest V3
src/
  background/service-worker.js Defaults on install, and the toolbar badge
  content/
    loader.js                  The only file the manifest names
    main.js                    Mounts every tool, and unmounts them live
    presence.js                Whether this tab is the one with the animal in it
    tools.js                   The registry. Add the next tool here
  popup/                       The control panel
  shared/
    settings.js                Everything the extension remembers
    messages.js                The two message names the worker and pages share
  tools/
    lizard/                    One tool, in one folder
      page.js                  What it can see of the page it is standing on
      page-lines.js            What it says about what it can see
  icons/                       Drawn by tools/make-icons.py
tools/
  harness.html                 Development only. Watch the animal in a plain tab
  make-icons.py                Redraws the toolbar icons from the body plan
```

**Adding a second tool** is a folder under `src/tools/` exporting `id`, `name`
and an async `mount()` that returns an `unmount()`, plus one line in
`src/content/tools.js`. The content script knows nothing else about any of them.

## Watching it work

The rare behaviours are rare on purpose, which makes them impossible to check by
watching. Turn on **Debug timing** and read `window.__critter` from the console,
or serve this folder and open the harness, which stubs the two extension APIs so
the animal runs in an ordinary tab:

```bash
cd ~/Developer/lizard-extension && python3 -m http.server 8931
```

Then open `http://localhost:8931/tools/harness.html`.

## Notes

- It removes itself entirely for `prefers-reduced-motion: reduce`, and for
  windows under 320px wide. It is not slowed down; it is not there.
- It runs in the top frame only. Four lizards walking over four ad iframes is
  not the feature.
- A hidden tab never has it, so there is never more than one on screen at a
  time, and a background tab is not animating anything.
- On a real site the whole thing lives in a shadow root, so no rule of ours can
  reach the page and no rule of theirs can reach the animal.
