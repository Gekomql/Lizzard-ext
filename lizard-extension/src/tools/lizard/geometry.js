/**
 * The geometry a crawling animal needs. No DOM, no extension APIs, no time.
 *
 * Copied out of Lumen's `src/lib/lizard.ts` with the TypeScript types removed
 * and nothing else changed. Every function is total — hand it a zero-length
 * body, two identical points or an unreachable foot and it returns something
 * finite. A frame loop that starts producing NaN does not throw, it just
 * quietly stops being an animal for the rest of the page's life.
 *
 * The three ideas the lizard is built out of:
 *
 *   1. A *spine that follows*. Only the head is steered. Every joint behind it
 *      is pulled to a fixed distance from the joint in front, with a limit on
 *      how far it may bend. That limit is what separates a spine from a rope:
 *      without it the body folds back through itself on a hard turn.
 *   2. An *outline swept from the spine*. The silhouette is the spine offset
 *      left and right by a per-joint half-width, so the shape is never drawn
 *      twice — it is always the current pose.
 *   3. *Feet that stay where they were put*. A foot holds its spot on the
 *      screen until the body has walked far enough past it, then swings to a
 *      new one. Sliding feet are the single clearest tell of a fake walk.
 */

/* ------------------------------------------------------------------ anatomy */

const SIZE = 1.18;

/** Gap between each joint and the next, snout to tail tip. */
export const SPACING = [4.4, 4, 4.6, 5, 5.4, 5.4, 5.2, 5.4, 5.6, 5.8, 6, 6, 5.8, 5.4, 5].map(
  (v) => v * SIZE,
);

/**
 * Half-width at each joint. Wide at the jaw and the hips, pinched at the neck.
 *
 * Snout, jaw, neck, shoulders, chest, waist, belly, hips, then the tail. The
 * jaw is wider than the neck and the hips are as wide as the chest, which is
 * the pair of proportions that separate a lizard from a newt.
 */
export const WIDTH = [
  2.1, 5.4, 3.6, 5.6, 6, 5, 5.2, 6, 4.5, 3.8, 3.2, 2.7, 2.2, 1.7, 1.15, 0.55,
].map((v) => v * SIZE);

export const JOINTS = WIDTH.length;

/** Radians a joint may bend away from the one in front of it. */
export const MAX_BEND = 0.24;

/**
 * Distance from the snout to each joint.
 *
 * This is what makes burrowing work without a single fade. When the animal
 * walks into a hole, the joints it has already dragged past the rim are simply
 * not drawn, and a joint is past the rim once the head has travelled further
 * than that joint is from the head. Coming back out is the same sum in reverse.
 */
export const REACHED = SPACING.reduce((acc, gap, i) => {
  acc.push((acc[i - 1] ?? 0) + gap);
  return acc;
}, []);

/** How many joints have passed a point the head left `travelled` pixels ago. */
export function jointsPast(travelled) {
  let k = 0;
  while (k < REACHED.length && REACHED[k] <= travelled) k++;
  return k;
}

/** How wide the hole it leaves is. */
export const HOLE_RX = 9.5;

/**
 * Shoulders and hips, as spine indices, and the reach of the leg attached.
 *
 * `thigh` and `shin` are the drawn thickness at the root and the ankle. A hind
 * leg is heavier than a foreleg on every lizard that runs, and a limb that is
 * as thick at the ankle as at the hip is a pipe, not a leg.
 */
export const LEGS = [
  { joint: 3, side: 1, upper: 8.5, lower: 8.5, out: 13, fore: 5.5, bend: 1, thigh: 4.4, shin: 2.3 },
  { joint: 3, side: -1, upper: 8.5, lower: 8.5, out: 13, fore: 5.5, bend: -1, thigh: 4.4, shin: 2.3 },
  { joint: 7, side: 1, upper: 9.5, lower: 10, out: 14, fore: -4.5, bend: -1, thigh: 5.4, shin: 2.6 },
  { joint: 7, side: -1, upper: 9.5, lower: 10, out: 14, fore: -4.5, bend: 1, thigh: 5.4, shin: 2.6 },
].map((leg) => ({
  ...leg,
  upper: leg.upper * SIZE,
  lower: leg.lower * SIZE,
  out: leg.out * SIZE,
  fore: leg.fore * SIZE,
  thigh: leg.thigh * SIZE,
  shin: leg.shin * SIZE,
}));

/** A leg may only swing while these two are on the ground: the diagonal gait. */
export const BLOCKERS = [
  [1, 2],
  [0, 3],
  [0, 3],
  [1, 2],
];

export const TOES = [-0.95, -0.48, 0, 0.48, 0.95];
export const TOE_LEN = [4, 5.1, 5.6, 5, 3.9].map((v) => v * SIZE);

/* ---------------------------------------------------------------- the maths */

/** Anything non-finite becomes the fallback, at every boundary. */
export function finite(n, fallback = 0) {
  return Number.isFinite(n) ? n : fallback;
}

export function distance(a, b) {
  return finite(Math.hypot(b.x - a.x, b.y - a.y));
}

/** Angle of the vector a → b, in radians. */
export function angleBetween(a, b) {
  return finite(Math.atan2(b.y - a.y, b.x - a.x));
}

/** Folds any angle into -π…π, so two headings can be compared. */
export function wrapAngle(a) {
  if (!Number.isFinite(a)) return 0;
  const t = (a + Math.PI) % (Math.PI * 2);
  return (t < 0 ? t + Math.PI * 2 : t) - Math.PI;
}

/** Keeps `angle` within `max` radians of `anchor`. */
export function constrainAngle(angle, anchor, max) {
  const delta = wrapAngle(finite(angle) - finite(anchor));
  const limit = Math.abs(finite(max, Math.PI));
  if (delta > limit) return wrapAngle(anchor + limit);
  if (delta < -limit) return wrapAngle(anchor - limit);
  return wrapAngle(angle);
}

/**
 * Drags the body after the head.
 *
 * `spine[0]` is replaced by `head`; each joint after it keeps its own heading
 * where it can and is otherwise bent by at most `maxBend` toward the segment in
 * front. Distances come out exact, which is why the body never stretches when
 * the head is thrown across the screen.
 */
export function followSpine(spine, head, spacing, maxBend) {
  if (spine.length === 0) return [];
  const out = [{ x: finite(head.x), y: finite(head.y) }];

  // The heading of the segment in front of the one being placed. For the first
  // joint that is the head's own direction of travel, read off the old pose.
  let ahead = spine.length > 1 ? angleBetween(out[0], spine[1]) : 0;

  for (let i = 1; i < spine.length; i++) {
    const prev = out[i - 1];
    const old = spine[i];
    const gap = distance(prev, old);
    // Two joints exactly on top of each other have no direction to offer; keep
    // pointing the way the body already points rather than snapping to zero.
    const wanted = gap < 0.001 ? ahead : angleBetween(prev, old);
    const angle = i === 1 ? wanted : constrainAngle(wanted, ahead, maxBend);
    const length = finite(spacing[i - 1], 6);
    out.push({
      x: prev.x + Math.cos(angle) * length,
      y: prev.y + Math.sin(angle) * length,
    });
    ahead = angle;
  }
  return out;
}

/** The direction the body runs at joint `i`, averaged across its neighbours. */
export function headingAt(spine, i) {
  if (spine.length < 2) return 0;
  const a = spine[Math.max(0, i - 1)];
  const b = spine[Math.min(spine.length - 1, i + 1)];
  return distance(a, b) < 0.001 ? 0 : angleBetween(b, a);
}

/**
 * The silhouette, swept from the spine.
 *
 * Walks up one flank and back down the other, with a rounded snout in front and
 * a point at the tail, so the result is a closed ring ready to be smoothed.
 */
export function outline(spine, widths) {
  if (spine.length < 2) return [];
  const ring = [];
  const head = spine[0];
  const nose = headingAt(spine, 0) + Math.PI;
  const w0 = finite(widths[0], 1);

  // Snout: three points across the front rather than one, or the head comes to
  // a beak. A lizard's is blunt.
  ring.push({
    x: head.x + Math.cos(nose - 0.9) * w0,
    y: head.y + Math.sin(nose - 0.9) * w0,
  });
  ring.push({ x: head.x + Math.cos(nose) * w0 * 0.72, y: head.y + Math.sin(nose) * w0 * 0.72 });
  ring.push({
    x: head.x + Math.cos(nose + 0.9) * w0,
    y: head.y + Math.sin(nose + 0.9) * w0,
  });

  for (let i = 0; i < spine.length; i++) {
    const h = headingAt(spine, i);
    const w = finite(widths[i], 1);
    ring.push({
      x: spine[i].x + Math.cos(h + Math.PI / 2) * w,
      y: spine[i].y + Math.sin(h + Math.PI / 2) * w,
    });
  }

  const tip = spine[spine.length - 1];
  const back = headingAt(spine, spine.length - 1);
  ring.push({ x: tip.x + Math.cos(back) * 1.5, y: tip.y + Math.sin(back) * 1.5 });

  for (let i = spine.length - 1; i >= 0; i--) {
    const h = headingAt(spine, i);
    const w = finite(widths[i], 1);
    ring.push({
      x: spine[i].x + Math.cos(h - Math.PI / 2) * w,
      y: spine[i].y + Math.sin(h - Math.PI / 2) * w,
    });
  }
  return ring;
}

/**
 * A closed Catmull-Rom curve through every point, written as cubic beziers.
 *
 * Straight lines between outline points would give the animal a faceted, cut
 * out look at exactly the size it is drawn at.
 */
export function smoothPath(points, closed = true) {
  const n = points.length;
  if (n < 3) return "";
  const at = (i) => (closed ? points[((i % n) + n) % n] : points[Math.min(n - 1, Math.max(0, i))]);

  const r = (v) => finite(v).toFixed(2);
  let d = `M ${r(at(0).x)} ${r(at(0).y)}`;
  const last = closed ? n : n - 1;
  for (let i = 0; i < last; i++) {
    const p0 = at(i - 1);
    const p1 = at(i);
    const p2 = at(i + 1);
    const p3 = at(i + 2);
    const c1 = { x: p1.x + (p2.x - p0.x) / 6, y: p1.y + (p2.y - p0.y) / 6 };
    const c2 = { x: p2.x - (p3.x - p1.x) / 6, y: p2.y - (p3.y - p1.y) / 6 };
    d += ` C ${r(c1.x)} ${r(c1.y)}, ${r(c2.x)} ${r(c2.y)}, ${r(p2.x)} ${r(p2.y)}`;
  }
  return closed ? `${d} Z` : d;
}

/**
 * Where the elbow or knee goes.
 *
 * Two bones of fixed length from `root` to `target`; `bend` picks which of the
 * two mirrored solutions to use, which is how the front legs bow forward and
 * the back legs bow backward the way a sprawling lizard's do. A target further
 * away than the leg is long straightens it instead of returning nothing.
 */
export function solveTwoBone(root, target, upper, lower, bend) {
  const reach = distance(root, target);
  const dir = angleBetween(root, target);
  if (reach < 0.001) {
    return { x: root.x + upper, y: root.y };
  }
  if (reach >= upper + lower) {
    // Straight leg, stopping at the joint.
    return { x: root.x + Math.cos(dir) * upper, y: root.y + Math.sin(dir) * upper };
  }
  // Law of cosines, clamped: floating point drift at full extension can hand
  // acos a value a hair outside -1…1, and acos(1.0000001) is NaN.
  const cos = (reach * reach + upper * upper - lower * lower) / (2 * reach * upper);
  const spread = Math.acos(Math.min(1, Math.max(-1, finite(cos))));
  const angle = dir + spread * bend;
  return { x: root.x + Math.cos(angle) * upper, y: root.y + Math.sin(angle) * upper };
}

/** Height of a foot through its swing: 0 on the ground, 1 at the top. */
export function stepLift(t) {
  const clamped = Math.min(1, Math.max(0, finite(t)));
  return Math.sin(clamped * Math.PI);
}

/** Eased 0…1, for anything that should start and stop softly. */
export function easeInOut(t) {
  const c = Math.min(1, Math.max(0, finite(t)));
  return c < 0.5 ? 2 * c * c : 1 - (-2 * c + 2) ** 2 / 2;
}

export function lerp(a, b, t) {
  return finite(a) + (finite(b) - finite(a)) * Math.min(1, Math.max(0, finite(t)));
}

/**
 * Does this foot have to swing?
 *
 * Two reasons, and the second one is not optional.
 *
 * The first is the gait: a foot lifts once the body has walked past it, and
 * only while the legs it shares its weight with are on the ground. A faster
 * body trips it sooner, because a threshold that *grows* with speed holds the
 * legs back at exactly the moment the body is outrunning them.
 *
 * The second overrides the gait completely. Past this distance the leg would
 * have to be longer than it is, and a real animal breaks its rhythm long before
 * it dislocates a hip. Leaving this out is what drew a lizard with two straight
 * lines trailing a hundred pixels behind it.
 */
export function needsStep(behind, reach, speed, partnersDown) {
  const gait =
    partnersDown && finite(behind) > 8.5 - Math.min(3, Math.max(0, finite(speed)) * 0.02);
  const forced = finite(behind) > finite(reach) * 0.6;
  return gait || forced;
}

/**
 * The last line of defence, applied to the foot as it is drawn.
 *
 * Whatever the state of the walk — a resize, a tab coming back, a row that
 * moved out from under a planted foot — a foot further from the shoulder than
 * the leg is long is pulled back onto the edge of what the leg can reach.
 */
export function withinReach(root, foot, reach) {
  const span = distance(root, foot);
  const limit = Math.max(0, finite(reach));
  if (span <= limit) return { x: finite(foot.x), y: finite(foot.y) };
  const a = angleBetween(root, foot);
  return { x: root.x + Math.cos(a) * limit, y: root.y + Math.sin(a) * limit };
}
