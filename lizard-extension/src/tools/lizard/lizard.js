/**
 * A lizard that lives in the interface.
 *
 * Ported from Lumen's `src/components/critter/lizard.tsx`. React is gone: what
 * was a `useEffect` is now `createLizard()`, and what was JSX is `markup.js`.
 * The loop itself is unchanged, because it never touched React in the first
 * place — it writes straight to SVG attributes inside one animation frame.
 *
 * It is not a sticker. It reads the page it is standing on: every frame it can
 * measure the real painted extent of the real words on the page (a Range around
 * each text node, not the element's box, so it walks the *letters* and not the
 * padding), picks one, walks there, and stands on it. What it thinks about is
 * whatever word is under its feet.
 *
 * Three things do most of the work of making it read as an animal:
 *
 *   - **Burst and freeze.** Lizards do not travel at a constant speed. They
 *     sprint, stop dead, and hold. A creature crossing the screen at a steady
 *     rate reads as a cursor with legs no matter how well it is drawn.
 *   - **Feet that stay put.** A foot holds its spot on the glass until the body
 *     has walked past it, then swings forward in an arc, and only ever in
 *     diagonal pairs. Sliding feet are the tell that ruins everything else.
 *   - **A spine, not a rope.** Only the head is steered; the rest is dragged,
 *     with a limit on how far each joint may bend, plus a lateral wave that
 *     runs down the body into the tail.
 */

import {
  BLOCKERS,
  JOINTS,
  LEGS,
  MAX_BEND,
  REACHED,
  SPACING,
  TOES,
  TOE_LEN,
  WIDTH,
  angleBetween,
  distance,
  easeInOut,
  followSpine,
  headingAt,
  jointsPast,
  needsStep,
  outline,
  smoothPath,
  solveTwoBone,
  stepLift,
  withinReach,
  wrapAngle,
} from "./geometry.js";
import { lizardMarkup } from "./markup.js";
import { emergeLine, flyLine, lineForLedge, nagLines, travelLine, wordLine } from "./lines.js";
import { readPage } from "./page.js";
import { contextLines } from "./page-lines.js";

const rand = (a, b) => a + Math.random() * (b - a);

/* ------------------------------------------------------------------ ledges */

/**
 * Words it can stand on, measured where they are actually painted.
 *
 * Same measurement as in Lumen: a Range around each text node, which is the
 * painted extent of the words rather than the box they sit in. Anything that
 * measures outside the viewport is skipped — a hidden element still measures,
 * and trusting that measurement is what had the animal walking to coordinates
 * nobody could see.
 */
function collectLedges(root, found, doc) {
  const width = doc.defaultView.innerWidth;
  const height = doc.defaultView.innerHeight;
  const walker = doc.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let node = walker.nextNode();

  while (node && found.length < 40) {
    const text = (node.nodeValue ?? "").trim();
    if (text.length >= 3) {
      const range = doc.createRange();
      range.selectNodeContents(node);
      const r = range.getBoundingClientRect();
      if (
        // Wide enough for four feet, tall enough to be real text, and actually
        // on the screen.
        r.width >= 24 &&
        r.height >= 8 &&
        r.left >= 2 &&
        r.right <= width - 2 &&
        r.top > 56 &&
        r.bottom < height - 4
      ) {
        found.push({ x1: r.left, x2: r.right, y: r.bottom - 2.5, label: text });
      }
    }
    node = walker.nextNode();
  }
}

/**
 * Where to look for words, in order of how much it would like to live there.
 *
 * Lumen marks its rail with `data-critter-rail` and that is still checked
 * first, so the animal behaves identically inside the app it came from. On
 * every other site there is no such attribute, so it falls back to the page's
 * navigation and then to the page itself.
 */
const RAIL = "[data-critter-rail]";
const NAV = "nav, aside, [role='navigation'], header";

function readLedges(doc) {
  const found = [];
  for (const rail of doc.querySelectorAll(RAIL)) collectLedges(rail, found, doc);
  if (found.length < 5) {
    for (const nav of doc.querySelectorAll(NAV)) collectLedges(nav, found, doc);
  }
  /*
   * A thin navigation is a route of about four steps. When there is that
   * little, the page it is sitting on gets used as well, so there is somewhere
   * to go.
   */
  if (found.length < 5) {
    const page = doc.querySelector("main") ?? doc.body;
    if (page) collectLedges(page, found, doc);
  }
  return found;
}

/* ----------------------------------------------------------------- welcome */

/**
 * Is a moving animal welcome here?
 *
 * Two ways the answer is no, and both can change while the page is open, which
 * is why this is a subscription rather than a check on mount: the system
 * setting, and a window too narrow to walk in. Whether *you* want it is a third
 * question, and it is the caller's, not this file's.
 */
export function watchWelcome(view, onChange) {
  const media = view.matchMedia("(prefers-reduced-motion: reduce)");
  media.addEventListener("change", onChange);
  view.addEventListener("resize", onChange);
  return () => {
    media.removeEventListener("change", onChange);
    view.removeEventListener("resize", onChange);
  };
}

export function isWelcome(view) {
  return !(
    view.matchMedia("(prefers-reduced-motion: reduce)").matches ||
    /*
     * A window too narrow to hold the animal at all.
     *
     * Zero is not narrow, it is *unknown* — a window reports zero width while
     * it is not being displayed, and treating that as "too small" tore the
     * lizard out of the page and rebuilt it from scratch the moment the window
     * came back. A measurement of nothing is not a measurement.
     */
    (view.innerWidth > 0 && view.innerWidth < 320)
  );
}

/* ------------------------------------------------------------------- mount */

/**
 * Put one lizard on a document and start it walking.
 *
 * `host` is the element the layer is appended to. `getFacts` is called for
 * every thought, so what it says is always current. Returns a `destroy` that
 * removes the animal and every listener it added, which is what makes it safe
 * to switch off from the popup without reloading the tab.
 */
export function createLizard({
  host,
  doc = host.ownerDocument,
  getFacts,
  debug = false,
  thoughts = true,
  entrance = "walk",
}) {
  const view = doc.defaultView;
  const SVG_NS = "http://www.w3.org/2000/svg";

  const layer = doc.createElement("div");
  layer.className = "critter-layer";
  layer.setAttribute("aria-hidden", "true");

  const svg = doc.createElementNS(SVG_NS, "svg");
  svg.setAttribute("class", "critter-svg");
  svg.setAttribute("xmlns", SVG_NS);
  svg.innerHTML = lizardMarkup();

  const bubble = doc.createElement("div");
  bubble.className = "critter-think";
  bubble.dataset.open = "false";
  const say = doc.createElement("span");
  bubble.append(say);

  layer.append(svg, bubble);
  host.append(layer);

  const q = (sel) => svg.querySelector(sel);
  const all = (sel) => Array.from(svg.querySelectorAll(sel));

  const body = q('[data-lz="body"]');
  const clip = q('[data-lz="clip"]');
  const shade = q('[data-lz="shade"]');
  const back = q('[data-lz="back"]');
  const ridge = q('[data-lz="ridge"]');
  const rim = q('[data-lz="rim"]');
  const rimLight = q("#lz-rim");
  const shadow = q('[data-lz="shadow"]');
  const shadowSeat = q('[data-lz="shadow-seat"]');
  const torso = q('[data-lz="torso"]');
  const stripes = all('[data-lz="stripe"]');
  const chevrons = q('[data-lz="chevrons"]');
  const textures = all('pattern[data-lz="tex"]');
  const swatches = all('[data-lz="swatch"]');
  const head = q('[data-lz="head"]');
  const lids = all('[data-lz="lid"]');
  const pupils = all('[data-lz="pupil"]');
  const throat = q('[data-lz="throat"]');
  const tongue = q('[data-lz="tongue"]');
  const marks = all('[data-lz="mark"]');
  const bands = all('[data-lz="band"]');
  const uppers = all('[data-lz="upper"]');
  const lowers = all('[data-lz="lower"]');
  const upperShades = all('[data-lz="upper-shade"]');
  const lowerShades = all('[data-lz="lower-shade"]');
  const knees = all('[data-lz="knee"]');
  const palms = all('[data-lz="palm"]');
  const toesNear = all('[data-lz="toes-near"]');
  const toesFar = all('[data-lz="toes-far"]');
  const claws = all('[data-lz="claws"]');
  const animal = q('[data-lz="animal"]');
  const ground = q('[data-lz="ground"]');
  const grit = all('[data-lz="grit"]');
  const flyNode = q('[data-lz="fly"]');
  const wings = all('[data-lz="wing"]');

  /* ------------------------------------------------------------ the animal */

  let spine = Array.from({ length: JOINTS }, (_, i) => ({
    x: view.innerWidth * 0.5 - i * 5,
    y: view.innerHeight * 0.55,
  }));
  let heading = 0;
  let ledges = [];
  let standingOn = null;
  /*
   * What it can see of the page, re-read on the same beat as the ledges.
   *
   * `readPage` remembers its expensive half per URL, so this is a scroll
   * position and a video's clock most of the time, and a full survey only when
   * you have actually gone somewhere else.
   */
  let page = null;

  /*
   * It always has somewhere to be.
   *
   * The route is a queue of stops that is topped up every frame, so there is
   * never a moment where the animal has arrived and has nothing next. That is
   * the difference between a wandering animal and a screensaver: a screensaver
   * finishes a move and picks a new one, and you can feel the seam. Nothing
   * here ever resets — its position is only ever changed by adding this frame's
   * movement to it, never by being assigned a new one, so it cannot jump.
   */
  const route = [];
  let escape = { x: 0, y: 0 };
  /** If a stop turns out to be unreachable, give up on it and walk on. */
  let leaveBy = 0;
  /** Slow steering noise, so it curves toward a stop instead of ruling a line. */
  const drift = Math.random() * 100;

  /*
   * walk   going somewhere.
   * pause  arrived, breathing, judging you.
   * flee   the pointer came too close.
   * hunt   there is a fly. Everything else can wait.
   * dig    going into the ground, head first.
   * under  gone.
   * rise   coming back out somewhere else entirely.
   */
  let mode = "walk";
  let modeUntil = 0;

  /*
   * Whether this page still has it.
   *
   * There is one animal in the whole browser, and `away` is how a page that has
   * lost it stays lost: while it is true the ordinary "come back up in a
   * minute" rule is switched off, so it stays in the ground until whatever put
   * it there calls `arrive()` again. `arriving` marks the one rise that is it
   * following you here rather than a rise it chose, because those are two
   * different events and they do not say the same thing when they surface.
   */
  let away = false;
  let arriving = false;

  /* The burrow. `travelled` is how far the head has moved since it started
     digging or emerging, which is the only number either needs. */
  const hole = { x: 0, y: 0 };
  let travelled = 0;
  let groundFade = 0;
  let digAt = performance.now() + rand(70000, 140000);
  /** Grit thrown out of the hole. Real physics, small numbers, cheap. */
  const grains = grit.map(() => ({ p: { x: 0, y: 0 }, v: { x: 0, y: 0 }, life: 0 }));

  /* The fly. It is not a decoration either: it is prey, and the hunt is a real
     pursuit that can fail. */
  let fly = null;
  let flyAt = performance.now() + rand(14000, 34000);
  let huntUntil = 0;
  let caught = 0;

  /** Left alone for long enough, it will interrupt you. That is the point. */
  let nagAt = performance.now() + rand(22000, 48000);

  /*
   * Debug compresses the whole schedule.
   *
   * The burrow and the hunt are deliberately rare, which makes them impossible
   * to check by watching. It changes the timing of events, never what they do,
   * so what you are looking at is the real behaviour and not a mock of it.
   */
  if (debug) {
    const t0 = performance.now();
    digAt = t0 + 7000;
    flyAt = t0 + 2500;
    nagAt = t0 + 6000;
  }

  // Burst and freeze, within a walk.
  let phaseUntil = 0;
  let phaseSpeed = 0;
  let speed = 0;

  let blinkAt = 1200;
  let blink = 0;
  let flickAt = 4000;
  let flick = 0;
  /*
   * Push-ups. A perched lizard bobs its whole front end up and down in short
   * sets — a territorial display, and the single most lizard-like thing a
   * lizard does. The body rises on the legs; the feet stay exactly where they
   * are, which is why the torso is scaled and the limbs are not.
   */
  let pushAt = performance.now() + rand(9000, 24000);
  let pushes = 0;
  let pushT = 0;

  const feet = LEGS.map(() => ({
    at: { x: spine[3].x, y: spine[3].y },
    from: { x: 0, y: 0 },
    to: { x: 0, y: 0 },
    t: 1,
    dur: 0.2,
  }));
  let footInit = false;

  const pointer = { x: -9999, y: -9999 };
  const onPointer = (e) => {
    pointer.x = e.clientX;
    pointer.y = e.clientY;
  };
  view.addEventListener("pointermove", onPointer, { passive: true });
  /*
   * A finger is not a cursor. On a touch screen there is no pointer hovering
   * anywhere, so the only warning it gets is the touch itself.
   */
  view.addEventListener("pointerdown", onPointer, { passive: true });

  // Something moved the ground. A real one freezes, then bolts.
  let startled = false;
  let scrolledAt = 0;
  const onScroll = () => {
    startled = true;
  };
  view.addEventListener("scroll", onScroll, { passive: true, capture: true });

  /* ------------------------------------------------------------- the voice */

  const clock = () => {
    const f = getFacts();
    return { ...f, hour: new Date().getHours() };
  };
  const spoken = [];
  let line = "";
  let shown = 0;
  let hideAt = 0;

  /*
   * How long a thought stays up. Long enough to actually read it, and then
   * some: roughly three seconds to notice it, plus reading time at a
   * comfortable pace, plus the time it spends typing itself out.
   */
  const speak = (text, now) => {
    // Muted is not "say it quietly": nothing is written, nothing is shown, and
    // the code that waits for it to finish a sentence sees a closed bubble.
    if (!thoughts) return;
    line = text;
    shown = 0;
    hideAt = now + 5200 + text.length * 72;
    bubble.dataset.open = "true";
  };

  /** Anything it has not said in the last few thoughts. */
  const pick = (from) => {
    const fresh = from.filter((l) => !spoken.includes(l));
    const list = fresh.length > 0 ? fresh : from;
    return list[Math.floor(Math.random() * list.length)];
  };

  const remember = (text) => {
    spoken.push(text);
    if (spoken.length > 5) spoken.shift();
  };

  /*
   * What comes out of its mouth, in order of how annoying it is.
   *
   * A nag names one specific thing and tells you to go and do it — but only
   * where there is a real one to name. Then the word it is standing on. Then
   * the general pool. Which lines exist at all is `facts.js`'s decision, and it
   * refuses to invent any of them.
   */
  const think = (now) => {
    const f = clock();
    const nags = nagLines(f);
    const local = standingOn
      ? (f.configured ? lineForLedge(standingOn, f) : null) ?? wordLine(standingOn, f)
      : null;
    // Everything true about this page right now. Empty on a page it cannot
    // read anything honest about, and empty on a page with a password on it.
    const here = contextLines(page, f);
    const roll = Math.random();

    let text = null;
    // Landing somewhere new is the one moment where the page is the only
    // interesting thing in the room, so it gets first refusal.
    if (here.length > 0 && page?.fresh && roll < 0.8) text = pick(here);
    else if (nags.length > 0 && roll < 0.4) text = pick(nags);
    else if (here.length > 0 && roll < 0.58) text = pick(here);
    else if (local && roll < 0.78) text = local;
    if (!text) text = pick(f.pool);

    remember(text);
    speak(text, now);
  };

  /** Unprompted. You did not ask. It does not care. */
  const nudge = (now) => {
    const f = clock();
    const nags = nagLines(f);
    const here = contextLines(page, f);
    const roll = Math.random();

    let text = null;
    if (nags.length > 0 && roll < 0.55) text = pick(nags);
    else if (here.length > 0 && roll < 0.75) text = pick(here);
    if (!text) text = pick(f.pool);

    remember(text);
    speak(text, now);
  };

  /* --------------------------------------------------------- where to go */

  /** One more place to be. Mostly a word on the page; sometimes just a wall. */
  const nextStop = () => {
    // A quarter of the time it goes somewhere with no text on it at all, which
    // is what stops the route reading as a tour of a menu.
    const wander = ledges.length === 0 || Math.random() < 0.24;
    // A long bask now and then, but never a long *stillness*: it breathes,
    // sways and works its feet the whole time.
    const linger = Math.random() < 0.22 ? rand(4200, 8000) : rand(900, 3400);

    if (wander) {
      /*
       * Off the words, but not off to the far side of the screen: where there
       * is a rail it lives around it, so its wandering stays in that
       * neighbourhood. A hidden rail still measures, and it measures zero,
       * which would pin the whole animal into the left of the screen — so a
       * narrow one does not count as a neighbourhood at all.
       */
      const rail = doc.querySelector(RAIL)?.getBoundingClientRect();
      const far =
        rail && rail.width > 40
          ? Math.min(view.innerWidth - 40, rail.right + 210)
          : view.innerWidth - 30;
      return {
        p: {
          x: rand(30, Math.max(80, far)),
          y: rand(100, Math.max(140, view.innerHeight - 70)),
        },
        label: null,
        linger,
      };
    }

    // Nearer rows more often than far ones, so it works its way along a stretch
    // of the page rather than pinballing from top to bottom. The last place it
    // stood is excluded, or it stands on the same word all evening.
    const anchor = route.length > 0 ? route[route.length - 1].p : spine[0];
    const options = ledges
      .filter((l) => l.label !== standingOn)
      .sort((a, b) => Math.abs(a.y - anchor.y) - Math.abs(b.y - anchor.y))
      .slice(0, Math.max(5, Math.ceil(ledges.length * 0.55)));
    const chosen = options[Math.floor(Math.random() * options.length)] ?? ledges[0];
    return {
      p: {
        x: rand(chosen.x1 + 8, Math.max(chosen.x1 + 9, chosen.x2 - 8)),
        y: chosen.y,
      },
      label: chosen.label,
      linger,
    };
  };

  /** Kept full at all times. Four stops ahead is enough to never be idle. */
  const planRoute = () => {
    while (route.length < 4) route.push(nextStop());
  };

  /** Done here. Next. */
  const advance = (now) => {
    route.shift();
    planRoute();
    standingOn = null;
    mode = "walk";
    leaveBy = now + 15000;
    phaseUntil = 0;
  };

  const fleeFrom = (from, now) => {
    const away = angleBetween(from, spine[0]);
    escape = {
      x: Math.min(view.innerWidth - 40, Math.max(40, spine[0].x + Math.cos(away) * 280)),
      y: Math.min(view.innerHeight - 40, Math.max(90, spine[0].y + Math.sin(away) * 280)),
    };
    standingOn = null;
    mode = "flee";
    modeUntil = now + rand(700, 1200);
    phaseUntil = modeUntil;
    phaseSpeed = 235;
    bubble.dataset.open = "false";
  };

  /* --------------------------------------------------------- the burrow */

  /** Soil thrown out of a hole, in coordinates relative to the hole itself. */
  const spray = (force) => {
    for (const g of grains) {
      const a = Math.random() * Math.PI * 2;
      const speedOut = rand(26, 95) * force;
      g.p = { x: 0, y: 0 };
      g.v = { x: Math.cos(a) * speedOut, y: Math.sin(a) * speedOut };
      g.life = rand(0.5, 1.2);
    }
  };

  /** Down. Head first, at the spot it is standing on. */
  const startDig = (now) => {
    hole.x = spine[0].x + Math.cos(heading) * 5;
    hole.y = spine[0].y + Math.sin(heading) * 5;
    travelled = 0;
    groundFade = 1;
    standingOn = null;
    mode = "dig";
    phaseUntil = now;
    bubble.dataset.open = "false";
    spray(0.7);
  };

  /*
   * Up, somewhere else.
   *
   * This is the one moment the animal's position is set outright rather than
   * added to, and it is allowed to be: it is not a reset you can catch, it is
   * the whole event. The body is laid out in a line *behind* the rim, so every
   * joint is underground, and then it walks out of its own hole.
   */
  const startRise = (now) => {
    const spot = nextStop();
    hole.x = spot.p.x;
    hole.y = spot.p.y;
    heading = Math.random() < 0.5 ? rand(-0.7, 0.7) : Math.PI + rand(-0.7, 0.7);
    for (let i = 0; i < JOINTS; i++) {
      const behind = i === 0 ? 0 : REACHED[i - 1];
      spine[i] = {
        x: hole.x - Math.cos(heading) * behind,
        y: hole.y - Math.sin(heading) * behind,
      };
    }
    travelled = 0;
    groundFade = 1;
    speed = 0;
    footInit = false;
    mode = "rise";
    phaseUntil = now;
    spray(1);
  };

  /* ------------------------------------------------------------- drawing */

  const size = () => {
    svg.setAttribute("viewBox", `0 0 ${view.innerWidth} ${view.innerHeight}`);
  };
  size();
  view.addEventListener("resize", size);

  let measured = 0;
  let last = performance.now();
  const started = last;
  let raf = 0;

  const frame = (now) => {
    // A tab that was hidden hands back an enormous gap; walking it in one step
    // would fire the lizard across the screen. And a clock that ran backwards
    // would make `travelled` negative and leave it climbing out of a hole for
    // ever.
    const dt = Math.max(0, Math.min(0.05, (now - last) / 1000));
    last = now;
    const t = now - started;

    if (now - measured > 1100 || startled) {
      measured = now;
      ledges = readLedges(doc);
      page = readPage(doc, view);
    }

    if (startled) {
      startled = false;
      // Every word it was standing on just moved. Bolt, but not more than once
      // a second, or a long scroll turns into a permanent panic.
      if (now - scrolledAt > 1000 && (mode === "walk" || mode === "pause")) {
        scrolledAt = now;
        mode = "walk";
        phaseSpeed = 150;
        phaseUntil = now + rand(350, 700);
        leaveBy = now + 15000;
        // The bubble stays up. Being startled is not a reason to swallow a
        // sentence you were halfway through reading; only actual flight is.
      }
    }

    /* -- the fly ------------------------------------------------------ */

    const above = mode !== "dig" && mode !== "under" && mode !== "rise";

    if (!fly && above && now > flyAt) {
      // It comes in from an edge at roughly the animal's own height, so it
      // crosses the space the lizard is already working in.
      const left = Math.random() < 0.5;
      fly = {
        p: {
          x: left ? -12 : view.innerWidth + 12,
          y: Math.min(view.innerHeight - 70, Math.max(90, spine[0].y + rand(-150, 150))),
        },
        v: { x: left ? 95 : -95, y: rand(-40, 40) },
        still: 0,
        // It stays in the room for a while before it finds its way out again. A
        // fly that crosses the screen once and leaves never gets hunted, which
        // makes the whole behaviour theoretical.
        until: now + rand(22000, 40000),
      };
      flyAt = now + (debug ? rand(7000, 13000) : rand(50000, 105000));
    }

    if (fly) {
      if (now > fly.still) {
        // Erratic by construction: a random shove every frame, a speed cap, and
        // the occasional decision to sit down on something.
        fly.v.x += rand(-1, 1) * 760 * dt;
        fly.v.y += rand(-1, 1) * 760 * dt;
        const threat = distance(fly.p, spine[0]);
        if (threat < 46) {
          // It can see the lizard, and it is not stupid. It is also not faster
          // than one: a fly that can always outrun a lunge turns the hunt into
          // a thing that never resolves.
          const away = angleBetween(spine[0], fly.p);
          fly.v.x += Math.cos(away) * 330 * dt;
          fly.v.y += Math.sin(away) * 330 * dt;
        }
        if (threat > 190) {
          // Flies are drawn to warm things, and the warmest thing on this
          // screen is the lizard. Without this they simply never meet.
          const toward = angleBetween(fly.p, spine[0]);
          fly.v.x += Math.cos(toward) * 70 * dt;
          fly.v.y += Math.sin(toward) * 70 * dt;
        }
        const sp = Math.hypot(fly.v.x, fly.v.y);
        const cap = threat < 46 ? 175 : 120;
        if (sp > cap) {
          fly.v.x *= cap / sp;
          fly.v.y *= cap / sp;
        }
        fly.p.x += fly.v.x * dt;
        fly.p.y += fly.v.y * dt;
        if (fly.p.y < 74 || fly.p.y > view.innerHeight - 40) fly.v.y *= -1;
        fly.p.y = Math.min(view.innerHeight - 40, Math.max(74, fly.p.y));
        // Until it gives up on the room, the walls are walls.
        if (now < fly.until) {
          if (fly.p.x < 26 || fly.p.x > view.innerWidth - 26) fly.v.x *= -1;
          fly.p.x = Math.min(view.innerWidth - 26, Math.max(26, fly.p.x));
        }
        // Landing is what gives the lizard its chance, so it happens often.
        if (Math.random() < dt * 0.7) fly.still = now + rand(900, 3200);
      }
      if (fly.p.x < -50 || fly.p.x > view.innerWidth + 50) fly = null;
    }

    /* -- decide ------------------------------------------------------- */

    planRoute();

    if (above && mode !== "flee" && distance(spine[0], pointer) < 104) {
      fleeFrom(pointer, now);
    }

    // Prey beats plans. Nothing on the route matters while there is a fly.
    if (fly && (mode === "walk" || mode === "pause") && distance(spine[0], fly.p) < 380) {
      mode = "hunt";
      huntUntil = now + rand(7000, 13000);
      phaseUntil = 0;
    }
    if (mode === "hunt" && (!fly || now > huntUntil)) advance(now);

    if (mode === "flee" && now > modeUntil) advance(now);
    if (mode === "pause" && now > modeUntil) advance(now);

    // Every so often it simply leaves, and every so often it comes back. It
    // will not leave while there is prey in reach, and it finishes what it is
    // saying before it goes: burrowing mid sentence took the sentence with it.
    const preyNear = fly !== null && distance(spine[0], fly.p) < 320;
    const talking = bubble.dataset.open === "true";
    if ((mode === "walk" || mode === "pause") && !preyNear && !talking && now > digAt) {
      startDig(now);
    }
    // While it is away this is switched off entirely: it stays down until it is
    // sent for. `arriving` is that summons landing mid dig — it surfaces the
    // moment it is underground rather than waiting out the usual sulk.
    if (mode === "under" && !away && (arriving || now > modeUntil)) startRise(now);

    // And every so often it interrupts you, unasked.
    if ((mode === "walk" || mode === "pause") && now > nagAt && bubble.dataset.open !== "true") {
      nudge(now);
      nagAt = now + (debug ? rand(9000, 16000) : rand(34000, 78000));
    }

    const straight = {
      x: hole.x + Math.cos(heading) * 400,
      y: hole.y + Math.sin(heading) * 400,
    };
    const goal =
      mode === "flee"
        ? escape
        : mode === "hunt" && fly
          ? fly.p
          : mode === "dig" || mode === "rise"
            ? straight
            : route[0].p;
    const gap = distance(spine[0], goal);

    if (mode !== "pause" && mode !== "under") {
      if (mode === "dig") {
        // A scrabble, not a walk. Slow enough to watch it go in.
        phaseSpeed = 27;
      } else if (mode === "rise") {
        phaseSpeed = 36;
      } else if (now > phaseUntil) {
        if (mode === "hunt") {
          /*
           * The hunt is stalk, freeze, lunge. Creeping is what makes the lunge
           * read as a lunge; a lizard that simply drives at a fly at one speed
           * looks like it is on rails, and it also never catches anything.
           *
           * It waits for the fly to sit down. A landed fly is worth crossing a
           * whole page for; a flying one is only worth a lunge if it is already
           * within a body length.
           */
          const landed = fly !== null && now < fly.still;
          const close = gap < (landed ? 92 : 44);
          phaseSpeed = close ? rand(240, 330) : Math.random() < 0.58 ? rand(16, 40) : 0;
          phaseUntil = now + (close ? rand(300, 560) : rand(200, 720));
        } else {
          // Sprint, or stop dead and stare at nothing.
          const sprint = mode === "flee" || Math.random() < 0.7;
          phaseSpeed = sprint ? rand(70, 118) : 0;
          phaseUntil = now + (sprint ? rand(320, 880) : rand(180, 620));
        }
      }
      // Ease into and out of a burst rather than stepping the speed.
      speed += (phaseSpeed - speed) * Math.min(1, dt * 9);

      /*
       * Steering, from three things added together: the direction of the next
       * stop; a slow wander, so the path curves the way a real one does, fading
       * out as it closes in or it would circle the target forever; and the
       * edges of the screen, which push back before they are reached. Steering
       * away is what keeps the position from ever needing to be clamped, and a
       * clamp is a snap.
       *
       * Going into or out of the ground is the one time it does not steer at
       * all: a tunnel is a straight line, and a body that swerves halfway into
       * a hole tears itself off the rim.
       */
      const want = angleBetween(spine[0], goal);
      let turn = mode === "dig" || mode === "rise" ? 0 : wrapAngle(want - heading);
      if (mode === "walk") {
        const noise =
          Math.sin(t * 0.00062 + drift) * 0.62 + Math.sin(t * 0.00171 + drift * 2) * 0.38;
        turn += noise * 1.15 * Math.min(1, gap / 220);
      }

      const w = view.innerWidth;
      const h = view.innerHeight;
      const margin = 96;
      const push = { x: 0, y: 0 };
      if (spine[0].x < margin) push.x += (margin - spine[0].x) / margin;
      if (spine[0].x > w - margin) push.x -= (spine[0].x - (w - margin)) / margin;
      if (spine[0].y < margin + 40) push.y += (margin + 40 - spine[0].y) / margin;
      if (spine[0].y > h - margin) push.y -= (spine[0].y - (h - margin)) / margin;
      if ((push.x !== 0 || push.y !== 0) && mode !== "dig" && mode !== "rise") {
        turn += wrapAngle(Math.atan2(push.y, push.x) - heading) * 1.4;
      }

      /*
       * You cannot turn without traction. Turn rate is tied to how fast it is
       * actually travelling, because a body that pivots while standing still
       * winds its own spine into a spiral: sixteen joints each bending their
       * limit adds up to a snail.
       */
      const grip = Math.min(1, Math.max(0.1, speed / 55));
      const rate = (mode === "flee" ? 7 : 4.4) * dt * grip;
      heading = wrapAngle(heading + Math.max(-rate, Math.min(rate, turn)));

      if (mode === "walk" && gap < 9) {
        mode = "pause";
        modeUntil = now + route[0].linger;
        standingOn = route[0].label;
        if (Math.random() < 0.6) {
          think(now);
          // Stay put until it has finished saying it. Walking off mid sentence
          // drags the bubble across the screen while you are still reading it.
          modeUntil = Math.max(modeUntil, Math.min(hideAt + 500, now + 18000));
        }
      } else if (mode === "walk" && now > leaveBy) {
        // Unreachable, or something moved under it. Never stand there failing.
        advance(now);
      } else if (mode === "hunt" && fly && gap < 14) {
        // Got it.
        fly = null;
        caught += 1;
        flick = 1;
        speed = 0;
        mode = "pause";
        modeUntil = now + rand(1500, 2800);
        flyAt = now + (debug ? rand(6000, 11000) : rand(45000, 100000));
        speak(flyLine(caught, clock()), now);
      }
    } else if (mode === "pause") {
      // Paused, which is not stopped. It creeps, breathes and rocks its weight,
      // and the whole body answers because the spine follows the head.
      speed += (2.2 - speed) * Math.min(1, dt * 6);
      heading = wrapAngle(heading + Math.sin(t * 0.0007 + drift) * 0.5 * dt);
    } else {
      // Underground. Nothing to move.
      speed = 0;
    }

    // Movement is always *added*. Nothing here ever writes an absolute
    // position, so there is no frame in which the animal can jump.
    spine[0] = {
      x: spine[0].x + Math.cos(heading) * speed * dt,
      y: spine[0].y + Math.sin(heading) * speed * dt,
    };

    /*
     * How far it has gone since it broke the surface, which is the only number
     * the burrow needs: joints in front of that distance are out of the ground,
     * joints behind it are still in it.
     */
    if (mode === "dig" || mode === "rise") {
      travelled += speed * dt;
      // The last joint's index, not the joint *count*: `jointsPast` counts the
      // gaps between joints, of which there is one fewer. Asking for JOINTS
      // here is a burrow that never finishes, and an animal that digs forever
      // with its tail sticking out of the ground.
      if (jointsPast(travelled) >= JOINTS - 1) {
        if (mode === "dig") {
          mode = "under";
          modeUntil = now + (debug ? rand(3500, 6000) : rand(16000, 42000));
        } else {
          mode = "walk";
          leaveBy = now + 15000;
          digAt = now + (debug ? rand(14000, 22000) : rand(90000, 200000));
          speak(arriving ? travelLine(clock()) : emergeLine(clock()), now);
          arriving = false;
          // You moved on again while it was still climbing out. Straight back
          // down, mid sentence, which is the correct amount of dignity.
          if (away) startDig(now);
        }
      }
    }

    // A slow lateral sway of the head, applied as this frame's difference
    // rather than as an offset from a fixed point. Same reason.
    const sway = Math.sin(t * 0.0011) - Math.sin((t - dt * 1000) * 0.0011);
    spine[0].x += Math.cos(heading + Math.PI / 2) * sway * 2.4;
    spine[0].y += Math.sin(heading + Math.PI / 2) * sway * 2.4;

    // The backstop the steering above is designed never to need.
    spine[0].x = Math.min(view.innerWidth - 16, Math.max(16, spine[0].x));
    spine[0].y = Math.min(view.innerHeight - 8, Math.max(58, spine[0].y));

    /* -- pose --------------------------------------------------------- */

    spine = followSpine(spine, spine[0], SPACING, MAX_BEND);

    // Lateral undulation, strongest at the tail. Even standing still the tail
    // keeps a slow curl, which is most of what stops a resting lizard looking
    // like a photograph of one.
    const swim = 0.35 + Math.min(1, speed / 90) * 1.5;
    for (let i = 4; i < JOINTS; i++) {
      const h = headingAt(spine, i) + Math.PI / 2;
      const grow = ((i - 3) / (JOINTS - 4)) ** 1.6;
      const wave = Math.sin(t * 0.006 - i * 0.55) * grow * swim;
      spine[i] = { x: spine[i].x + Math.cos(h) * wave, y: spine[i].y + Math.sin(h) * wave };
    }

    /*
     * Which of it is above ground.
     *
     * Going down, the head is swallowed first and the range shrinks from the
     * front. Coming up, the head is out first and the range grows from the
     * front. Both are the same measurement. There is no fade and no scaling
     * anywhere in this, which is why it reads as a hole and not as a dissolve.
     */
    let frontJoint = 0;
    let backJoint = JOINTS - 1;
    if (mode === "dig") frontJoint = jointsPast(travelled);
    if (mode === "rise") backJoint = Math.min(JOINTS - 1, jointsPast(travelled));
    const buried = mode === "under" || frontJoint > backJoint;
    animal.setAttribute("opacity", buried ? "0" : "1");

    const visible = buried ? [] : spine.slice(frontJoint, backJoint + 1);

    /*
     * Breathing you can see in the flanks. The throat pulse alone reads as a
     * tic. Widening the whole body between the shoulders and the hips by a few
     * percent, on a slow cycle, and only when it is standing still, is what
     * makes a resting lizard look like it is resting rather than paused.
     */
    const calmness = 1 - Math.min(1, speed / 60);
    const breath = 1 + Math.sin(t * 0.0045) * 0.035 * calmness;
    const widths = buried
      ? []
      : WIDTH.slice(frontJoint, backJoint + 1).map((w, k) => {
          const j = frontJoint + k;
          return j >= 3 && j <= 7 ? w * breath : w;
        });

    const drawn = visible.length >= 2;
    const shape = drawn ? smoothPath(outline(visible, widths)) : "";
    body.setAttribute("d", shape);
    clip.setAttribute("d", shape);
    shade.setAttribute("d", shape);
    rim.setAttribute("d", shape);
    shadow.setAttribute("d", shape);
    back.setAttribute(
      "d",
      drawn ? smoothPath(outline(visible, widths.map((w) => w * 0.64))) : "",
    );
    ridge.setAttribute(
      "d",
      drawn ? smoothPath(outline(visible, widths.map((w) => w * 0.2))) : "",
    );

    // The body's centre and bearing. The skin texture and the moonlight are
    // both pinned to these, so scales ride the animal instead of the animal
    // sliding through a fixed sheet of them.
    const mid = spine[4];
    const bearing = angleBetween(spine[6], spine[2]);
    const bearingDeg = ((bearing * 180) / Math.PI).toFixed(1);
    for (const tex of textures) {
      tex.setAttribute(
        "patternTransform",
        `translate(${mid.x.toFixed(1)} ${mid.y.toFixed(1)}) rotate(${bearingDeg})`,
      );
    }

    // The textured sheets only need to cover the animal, and a sheet the size
    // of the screen is rasterised at the size of the screen.
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const pt of visible) {
      if (pt.x < minX) minX = pt.x;
      if (pt.y < minY) minY = pt.y;
      if (pt.x > maxX) maxX = pt.x;
      if (pt.y > maxY) maxY = pt.y;
    }
    if (!drawn) minX = minY = maxX = maxY = 0;
    for (const sheet of swatches) {
      sheet.setAttribute("x", (minX - 10).toFixed(1));
      sheet.setAttribute("y", (minY - 10).toFixed(1));
      sheet.setAttribute("width", (maxX - minX + 20).toFixed(1));
      sheet.setAttribute("height", (maxY - minY + 20).toFixed(1));
    }

    // Moonlight along the edge nearest the light (upper right), fading to
    // nothing on the far side. A gradient in page space, re-aimed each frame.
    rimLight.setAttribute("x1", (mid.x + 11).toFixed(1));
    rimLight.setAttribute("y1", (mid.y - 11).toFixed(1));
    rimLight.setAttribute("x2", (mid.x - 7).toFixed(1));
    rimLight.setAttribute("y2", (mid.y + 7).toFixed(1));

    // Two pale dorsolateral stripes, shoulder to tail base, the way a wall
    // lizard wears them. Built from the spine so they bend with it.
    for (let side = 0; side < 2; side++) {
      const sign = side === 0 ? 1 : -1;
      const pts = [];
      for (let j = 2; j <= 10; j++) {
        if (j < frontJoint || j > backJoint) continue;
        const h = headingAt(spine, j) + Math.PI / 2;
        const w = WIDTH[j] * 0.56 * sign;
        pts.push({ x: spine[j].x + Math.cos(h) * w, y: spine[j].y + Math.sin(h) * w });
      }
      stripes[side]?.setAttribute("d", pts.length >= 3 ? smoothPath(pts, false) : "");
    }

    // A row of keeled scales down the spine, drawn as chevrons that point the
    // way the animal does.
    let chev = "";
    for (let j = 3; j <= 12; j++) {
      if (j < frontJoint || j > backJoint) continue;
      const h = headingAt(spine, j);
      const fx = Math.cos(h);
      const fy = Math.sin(h);
      const nx = -fy;
      const ny = fx;
      const pt = spine[j];
      const half = Math.min(1, WIDTH[j] * 0.22);
      chev += `M ${(pt.x - fx * 0.7 + nx * half).toFixed(2)} ${(pt.y - fy * 0.7 + ny * half).toFixed(2)} L ${(
        pt.x + fx * 0.8
      ).toFixed(2)} ${(pt.y + fy * 0.8).toFixed(2)} L ${(pt.x - fx * 0.7 - nx * half).toFixed(2)} ${(
        pt.y - fy * 0.7 - ny * half
      ).toFixed(2)} `;
    }
    chevrons.setAttribute("d", chev);

    /* -- push-ups ------------------------------------------------------ */

    if (mode === "pause" && pushes === 0 && now > pushAt) {
      pushes = 2 + Math.floor(Math.random() * 3);
      pushT = 0;
    }
    if (mode !== "pause") pushes = 0;
    let bob = 0;
    if (pushes > 0) {
      pushT += dt * 3.3;
      bob = Math.sin(Math.min(1, pushT) * Math.PI);
      if (pushT >= 1) {
        pushes -= 1;
        pushT = 0;
        if (pushes === 0) pushAt = now + rand(14000, 40000);
      }
    }
    // The body rises on the legs; the feet stay planted. So the torso is scaled
    // about its own centre and the limbs, drawn separately, are not.
    torso.setAttribute(
      "transform",
      bob > 0.002
        ? `translate(${mid.x.toFixed(2)} ${mid.y.toFixed(2)}) scale(${(1 + bob * 0.065).toFixed(
            4,
          )}) translate(${(-mid.x).toFixed(2)} ${(-mid.y).toFixed(2)})`
        : "",
    );
    // A body held higher casts a longer, fainter shadow.
    shadowSeat.setAttribute(
      "transform",
      `translate(${(3.5 + bob * 2.2).toFixed(2)} ${(4.5 + bob * 2.6).toFixed(2)})`,
    );
    shadow.setAttribute("opacity", (0.42 - bob * 0.14).toFixed(3));

    /* -- legs --------------------------------------------------------- */

    const face = angleBetween(spine[1], spine[0]);

    /** A limb segment: a strip that is wider at one end than the other. */
    const taper = (a, b, wa, wb) => {
      const ang = angleBetween(a, b) + Math.PI / 2;
      const cx = Math.cos(ang);
      const cy = Math.sin(ang);
      return `M ${(a.x + cx * wa).toFixed(2)} ${(a.y + cy * wa).toFixed(2)} L ${(
        b.x + cx * wb
      ).toFixed(2)} ${(b.y + cy * wb).toFixed(2)} L ${(b.x - cx * wb).toFixed(2)} ${(
        b.y - cy * wb
      ).toFixed(2)} L ${(a.x - cx * wa).toFixed(2)} ${(a.y - cy * wa).toFixed(2)} Z`;
    };

    for (let i = 0; i < LEGS.length; i++) {
      const leg = LEGS[i];
      if (leg.joint < frontJoint || leg.joint > backJoint) {
        // That shoulder is underground. No leg.
        uppers[i]?.setAttribute("d", "");
        lowers[i]?.setAttribute("d", "");
        upperShades[i]?.setAttribute("d", "");
        lowerShades[i]?.setAttribute("d", "");
        knees[i]?.setAttribute("r", "0");
        palms[i]?.setAttribute("rx", "0");
        toesNear[i]?.setAttribute("d", "");
        toesFar[i]?.setAttribute("d", "");
        claws[i]?.setAttribute("d", "");
        continue;
      }
      const j = spine[leg.joint];
      // `headingAt` already points up the body toward the head; out to the side
      // is a right angle from it. Having this backwards is what made the feet
      // step behind the animal and then get dragged.
      const forward = headingAt(spine, leg.joint);
      const side = forward + (Math.PI / 2) * leg.side;
      const root = {
        x: j.x + Math.cos(side) * WIDTH[leg.joint] * 0.8,
        y: j.y + Math.sin(side) * WIDTH[leg.joint] * 0.8,
      };
      const ideal = {
        x: root.x + Math.cos(side) * leg.out + Math.cos(forward) * leg.fore,
        y: root.y + Math.sin(side) * leg.out + Math.sin(forward) * leg.fore,
      };

      const foot = feet[i];
      // How far the foot can be from the shoulder before the leg would have to
      // stretch to reach it. Nothing below is allowed past this.
      const reach = (leg.upper + leg.lower) * 0.9;

      if (!footInit) {
        foot.at = { ...ideal };
      } else if (foot.t >= 1) {
        const behind = distance(foot.at, ideal);
        // Its diagonal partners have to be carrying the weight before this one
        // may lift.
        const free = BLOCKERS[i].every((b) => feet[b].t >= 1);
        if (needsStep(behind, reach, speed, free)) {
          const stride = Math.min(10, speed * 0.11) + 3.5;
          foot.from = { ...foot.at };
          foot.to = {
            x: ideal.x + Math.cos(forward) * stride,
            y: ideal.y + Math.sin(forward) * stride,
          };
          foot.t = 0;
          // A faster body swings a faster leg. A fixed duration is the other
          // half of why feet get left behind at speed.
          foot.dur = speed > 60 ? 0.11 : speed > 25 ? 0.16 : 0.24;
        }
      }

      let lift = 0;
      if (foot.t < 1) {
        foot.t = Math.min(1, foot.t + dt / foot.dur);
        const e = easeInOut(foot.t);
        lift = stepLift(foot.t);
        foot.at = {
          x: foot.from.x + (foot.to.x - foot.from.x) * e,
          y: foot.from.y + (foot.to.y - foot.from.y) * e,
        };
      }

      // A lifted foot swings a little in toward the body: the only way to show
      // height when you are looking straight down at it.
      const placed = {
        x: foot.at.x - Math.cos(side) * lift * 2.4,
        y: foot.at.y - Math.sin(side) * lift * 2.4,
      };

      // Nothing is drawn beyond what the leg can reach, in any state.
      const standing = withinReach(root, placed, reach);
      const knee = solveTwoBone(root, standing, leg.upper, leg.lower, leg.bend);

      /*
       * Thigh, shin, and a round joint between them. Each is a strip that
       * narrows toward the foot. The joint is a disc the width of the thigh's
       * narrow end, laid over the seam, which is what turns two strips into a
       * bent limb rather than a broken one.
       */
      const kneeWidth = leg.thigh * 0.62;
      uppers[i]?.setAttribute("d", taper(root, knee, leg.thigh / 2, kneeWidth / 2));
      lowers[i]?.setAttribute("d", taper(knee, standing, kneeWidth / 2, leg.shin / 2));
      // A narrower, darker strip down each segment, pushed away from the light:
      // the underside of a cylinder, which is what a limb is.
      upperShades[i]?.setAttribute("d", taper(root, knee, leg.thigh * 0.22, kneeWidth * 0.22));
      lowerShades[i]?.setAttribute("d", taper(knee, standing, kneeWidth * 0.22, leg.shin * 0.22));
      knees[i]?.setAttribute("cx", knee.x.toFixed(2));
      knees[i]?.setAttribute("cy", knee.y.toFixed(2));
      knees[i]?.setAttribute("r", (kneeWidth / 2).toFixed(2));

      /*
       * The foot: a palm and five toes, each with a knuckle and a claw. Toes
       * have two segments because a real one bends at the knuckle, outer toes
       * curl outward a touch, and every one ends in a dark claw a pixel long.
       * At this size the claws are the difference between a foot and a star.
       */
      const point = angleBetween(knee, standing);
      palms[i]?.setAttribute("rx", (leg.shin * 0.72).toFixed(2));
      palms[i]?.setAttribute("ry", (leg.shin * 0.55).toFixed(2));
      palms[i]?.setAttribute(
        "transform",
        `translate(${standing.x.toFixed(2)} ${standing.y.toFixed(2)}) rotate(${(
          (point * 180) / Math.PI
        ).toFixed(1)})`,
      );
      let near = "";
      let far = "";
      let claw = "";
      for (let k = 0; k < TOES.length; k++) {
        const a = point + TOES[k] * (1 + leg.side * 0.12);
        const len = TOE_LEN[k] * (1 - lift * 0.42);
        const knuckle = {
          x: standing.x + Math.cos(a) * len * 0.55,
          y: standing.y + Math.sin(a) * len * 0.55,
        };
        const curl = TOES[k] * 0.2;
        const a2 = a + curl;
        const tip = {
          x: knuckle.x + Math.cos(a2) * len * 0.45,
          y: knuckle.y + Math.sin(a2) * len * 0.45,
        };
        const a3 = a2 + curl * 0.7;
        near += `M ${standing.x.toFixed(2)} ${standing.y.toFixed(2)} L ${knuckle.x.toFixed(2)} ${knuckle.y.toFixed(2)} `;
        far += `M ${knuckle.x.toFixed(2)} ${knuckle.y.toFixed(2)} L ${tip.x.toFixed(2)} ${tip.y.toFixed(2)} `;
        claw += `M ${tip.x.toFixed(2)} ${tip.y.toFixed(2)} L ${(tip.x + Math.cos(a3) * 1.3).toFixed(2)} ${(
          tip.y + Math.sin(a3) * 1.3
        ).toFixed(2)} `;
      }
      toesNear[i]?.setAttribute("d", near);
      toesFar[i]?.setAttribute("d", far);
      claws[i]?.setAttribute("d", claw);
    }
    footInit = true;

    /* -- markings ------------------------------------------------------ */

    // Irregular blotches either side of the spine. Three shapes, placed by
    // joint, so they turn with the body and never repeat side by side.
    for (let i = 0; i < marks.length; i++) {
      const at = 3 + (i % 5);
      marks[i].setAttribute("opacity", at < frontJoint || at > backJoint ? "0" : "0.42");
      const j = spine[at];
      const h = headingAt(spine, at);
      const off = (i < 5 ? 1 : -1) * WIDTH[at] * 0.42;
      const a = h + Math.PI / 2;
      marks[i].setAttribute(
        "transform",
        `translate(${(j.x + Math.cos(a) * off).toFixed(2)} ${(j.y + Math.sin(a) * off).toFixed(
          2,
        )}) rotate(${((h * 180) / Math.PI).toFixed(1)}) scale(${(0.85 + (i % 3) * 0.12).toFixed(2)})`,
      );
    }

    // Bands across the tail, slightly uneven, the way they grow.
    for (let i = 0; i < bands.length; i++) {
      const idx = 8 + i;
      bands[i].setAttribute("opacity", idx < frontJoint || idx > backJoint ? "0" : "0.4");
      const j = spine[Math.min(JOINTS - 1, idx)];
      const h = headingAt(spine, idx) + Math.PI / 2;
      const w = WIDTH[Math.min(JOINTS - 1, idx)] * (0.9 + (i % 2) * 0.08);
      bands[i].setAttribute(
        "d",
        `M ${(j.x + Math.cos(h) * w).toFixed(2)} ${(j.y + Math.sin(h) * w).toFixed(2)} L ${(
          j.x - Math.cos(h) * w
        ).toFixed(2)} ${(j.y - Math.sin(h) * w).toFixed(2)}`,
      );
    }

    /* -- head ---------------------------------------------------------- */

    head.setAttribute("opacity", frontJoint <= 1 && backJoint >= 1 ? "1" : "0");
    head.setAttribute(
      "transform",
      `translate(${spine[1].x.toFixed(2)} ${spine[1].y.toFixed(2)}) rotate(${(
        (face * 180) / Math.PI
      ).toFixed(1)})`,
    );

    if (now > blinkAt) {
      blink = 1;
      blinkAt = now + rand(2400, 7000);
    }
    blink = Math.max(0, blink - dt * 7);
    const shut = Math.sin(Math.min(1, blink) * Math.PI);
    for (const lid of lids) lid.setAttribute("ry", (0.05 + shut * 2.5).toFixed(2));

    // The eyes wander slowly while it sits, and lock forward when it moves.
    const gaze = Math.sin(t * 0.0013 + drift) * 0.6 * calmness;
    for (const pupil of pupils) pupil.setAttribute("cx", gaze.toFixed(2));

    // Breathing shows in the throat too, and only when it is standing still.
    throat.setAttribute("rx", (3.4 + Math.sin(t * 0.0045) * 0.42 * calmness).toFixed(2));
    throat.setAttribute("ry", (2.5 + Math.sin(t * 0.0045) * 0.3 * calmness).toFixed(2));

    if (now > flickAt && mode === "pause") {
      flick = 1;
      flickAt = now + rand(5000, 13000);
    }
    flick = Math.max(0, flick - dt * 3.4);
    const out = Math.sin(Math.min(1, flick) * Math.PI) * 5.6;
    tongue.setAttribute("opacity", out > 0.2 ? "0.9" : "0");
    // Forked, because it is.
    const tipX = (4.9 + out).toFixed(2);
    const tipY = (out * 0.16).toFixed(2);
    tongue.setAttribute(
      "d",
      out > 0.2
        ? `M 4.9 0 L ${tipX} ${tipY} M ${tipX} ${tipY} L ${(4.9 + out + 0.9).toFixed(2)} ${(
            out * 0.16 - 0.55
          ).toFixed(2)} M ${tipX} ${tipY} L ${(4.9 + out + 0.9).toFixed(2)} ${(out * 0.16 + 0.55).toFixed(2)}`
        : "",
    );

    /* -- the ground it came out of ------------------------------------ */

    // A hole it is still using stays on the page. A hole it has abandoned
    // collapses behind it, which is why leaving a tab does not litter it.
    const digging = mode === "dig" || mode === "rise" || (mode === "under" && !away);
    if (!digging && groundFade > 0) groundFade = Math.max(0, groundFade - dt * 0.22);
    ground.setAttribute("transform", `translate(${hole.x.toFixed(1)} ${hole.y.toFixed(1)})`);
    ground.setAttribute("opacity", (digging ? 1 : groundFade).toFixed(2));

    for (let i = 0; i < grains.length; i++) {
      const g = grains[i];
      if (g.life > 0) {
        g.life -= dt;
        // Thrown, then dragged to a stop. Where it stops is where it stays,
        // which is what turns a puff of dirt into a spoil heap.
        const drag = 1 - Math.min(1, dt * 3.4);
        g.v.x *= drag;
        g.v.y *= drag;
        g.p.x += g.v.x * dt;
        g.p.y += g.v.y * dt;
      }
      grit[i]?.setAttribute("cx", g.p.x.toFixed(1));
      grit[i]?.setAttribute("cy", g.p.y.toFixed(1));
      grit[i]?.setAttribute("opacity", g.life > 0 ? "0.85" : "0.42");
    }

    /* -- the fly ------------------------------------------------------- */

    if (fly) {
      flyNode.setAttribute("opacity", "1");
      flyNode.setAttribute(
        "transform",
        `translate(${fly.p.x.toFixed(1)} ${fly.p.y.toFixed(1)}) rotate(${(
          (Math.atan2(fly.v.y, fly.v.x) * 180) / Math.PI
        ).toFixed(0)})`,
      );
      // The wings only blur while it is actually flying. A landed fly with
      // beating wings is the tell that it is an animation and not an animal.
      const beat = now > fly.still ? 0.34 + Math.abs(Math.sin(t * 0.085)) * 0.7 : 0.2;
      for (const w of wings) w.setAttribute("ry", beat.toFixed(2));
    } else {
      flyNode.setAttribute("opacity", "0");
    }

    // In debug the whole state machine is readable from the console, which is
    // the only practical way to check a behaviour that fires once every few
    // minutes.
    if (debug) {
      view.__critter = {
        mode,
        speed: Math.round(speed),
        travelled: Math.round(travelled),
        digIn: Math.round((digAt - now) / 100) / 10,
        flyIn: Math.round((flyAt - now) / 100) / 10,
        fly: fly !== null,
        caught,
        joints: `${frontJoint}-${backJoint}`,
        bob: Math.round(bob * 100) / 100,
        standingOn,
        ledges: ledges.length,
        page: page && {
          site: page.site,
          kind: page.kind,
          words: page.words,
          scrolled: page.scrolled,
          seconds: page.seconds,
        },
      };
    }

    /* -- the thought --------------------------------------------------- */

    if (bubble.dataset.open === "true") {
      if (shown < line.length) {
        shown = Math.min(line.length, shown + dt * 40);
        say.textContent = line.slice(0, Math.floor(shown));
      }
      if (now > hideAt) bubble.dataset.open = "false";
      /*
       * Beside the head, and above it where there is room. Near the top of the
       * screen there is not, and clamping it upward just parked the bubble on
       * top of the animal: you got the joke and lost the thing telling it.
       * Below the head instead, with the thought dots flipped so they still
       * point at whoever is thinking.
       */
      const flip = spine[1].x > view.innerWidth - 300;
      const over = spine[1].y - 62 >= 58;
      const top = over ? spine[1].y - 62 : Math.min(view.innerHeight - 96, spine[1].y + 38);
      bubble.dataset.below = over ? "false" : "true";
      bubble.style.transform = `translate3d(${(flip
        ? Math.max(8, spine[1].x - 268)
        : Math.min(view.innerWidth - 260, spine[1].x + 18)
      ).toFixed(0)}px, ${top.toFixed(0)}px, 0)`;
    }

    raf = view.requestAnimationFrame(frame);
  };

  /* ---------------------------------------------------- following you about */

  /**
   * You are looking at something else now, so it goes.
   *
   * A hidden tab stops being given frames at all, so a dig started in one would
   * freeze half finished and still be there, mid dig, whenever you came back.
   * Nobody can watch a hole being dug in a tab that is not on the screen, so in
   * that case it is simply gone. Between two visible windows you get the dig.
   */
  const leave = () => {
    if (away) return;
    away = true;
    if (mode === "under" || mode === "dig") return;
    if (doc.hidden) {
      hole.x = spine[0].x;
      hole.y = spine[0].y;
      groundFade = 0;
      travelled = 0;
      standingOn = null;
      bubble.dataset.open = "false";
      mode = "under";
      return;
    }
    startDig(performance.now());
  };

  /** You are back, or you are new. Either way it comes up out of the floor. */
  const arrive = () => {
    away = false;
    if (mode === "under" || mode === "dig") arriving = true;
    if (mode === "under") startRise(performance.now());
  };

  ledges = readLedges(doc);
  page = readPage(doc, view);
  planRoute();
  leaveBy = performance.now() + 15000;
  // Arriving on a page it has never been on is the same event as arriving on
  // one it left an hour ago: it comes out of a hole, and it says so.
  if (entrance === "hole") {
    arriving = true;
    startRise(performance.now());
  }
  raf = view.requestAnimationFrame(frame);

  return {
    leave,
    arrive,
    destroy() {
      view.cancelAnimationFrame(raf);
      view.removeEventListener("pointermove", onPointer);
      view.removeEventListener("pointerdown", onPointer);
      view.removeEventListener("scroll", onScroll, { capture: true });
      view.removeEventListener("resize", size);
      layer.remove();
    },
  };
}
