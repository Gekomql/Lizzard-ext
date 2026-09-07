/**
 * The skeleton, as markup.
 *
 * In Lumen this was JSX that React rendered once and then left alone — the
 * component never re-renders, because redrawing fifty nodes sixty times a
 * second to move a pet would be absurd. Out here there is no React, so the same
 * tree is a string, built once at mount. Every `data-lz` hook, every filter and
 * every path is the one from `src/components/critter/lizard.tsx`.
 *
 * ---------------------------------------------------------------- the colour
 *
 * A real animal's colours, not an interface's. Warm sand over dark brown, lit
 * from the upper right. Volume comes from stacking, not gradients: a lighter
 * flank, a darker band down the back, a core shadow pushed away from the light,
 * and a rim of that light along the edge nearest it. Each is a copy of the same
 * outline, blurred and clipped back inside the silhouette, so the shading turns
 * with the body and never spills past the skin.
 */

import { HOLE_RX, LEGS } from "./geometry.js";

export const SAND = "#c2a470";
export const BACK = "#755a37";
export const DARK = "#3b2b18";
export const RIDGE = "#e8d09f";
export const MOON = "#f3b894";
export const CLAW = "#221910";
export const STRIPE = "#ead8ab";
/* Limbs are a shade darker than the flank: they are round, and most of what
   you see of a round thing lit from above is its side. */
export const LIMB = "#a88b5a";

/** Irregular blotches. Three shapes, cycled, so they never repeat side by side. */
const MARKS = [
  "M -2.6 -0.4 C -1.8 -1.8, 0.6 -1.9, 2.1 -0.9 C 3 -0.3, 2.4 1.2, 0.8 1.4 C -0.9 1.6, -2.9 1, -2.6 -0.4 Z",
  "M -2 -1.1 C -0.7 -2, 1.6 -1.6, 2.4 -0.2 C 2.9 0.8, 1.2 1.9, -0.4 1.6 C -1.9 1.3, -2.8 -0.2, -2 -1.1 Z",
  "M -1.7 -1.3 C -0.2 -1.9, 1.9 -1.2, 2.2 0.1 C 2.4 1.2, 0.9 1.9, -0.6 1.7 C -2 1.5, -2.6 -0.5, -1.7 -1.3 Z",
];

/**
 * One eye, at `cy`. Two of these, and the brow ridge on each, is most of why a
 * lizard's head reads as a skull and not a spoon.
 */
const eye = (cy, browY) => `
  <g transform="translate(0.6 ${cy})">
    <ellipse rx="2.5" ry="2.05" fill="url(#lz-eye)" stroke="${DARK}" stroke-width="0.45" stroke-opacity="0.7" />
    <circle data-lz="pupil" cx="0" cy="0" r="1.3" fill="#0b0803" />
    <circle cx="-0.85" cy="-0.75" r="0.34" fill="#fff" opacity="0.85" />
    <path d="M -2.6 ${browY} C -1.6 ${browY * 2}, 1.2 ${browY * 2.08}, 2.4 ${browY * 1.08}" stroke="${DARK}" stroke-width="0.6" fill="none" opacity="0.6" />
    <ellipse data-lz="lid" ry="0.05" rx="2.6" fill="${BACK}" />
  </g>`;

/** Thigh, shin, round joint, palm, five two-part toes, five claws. */
const leg = () => `
  <g>
    <path data-lz="upper" fill="${LIMB}" stroke="${DARK}" stroke-width="0.55" stroke-opacity="0.6" stroke-linejoin="round" />
    <path data-lz="lower" fill="${LIMB}" stroke="${DARK}" stroke-width="0.5" stroke-opacity="0.6" stroke-linejoin="round" />
    <circle data-lz="knee" fill="${LIMB}" />
    <path data-lz="upper-shade" fill="${DARK}" opacity="0.35" transform="translate(-0.4 0.5)" />
    <path data-lz="lower-shade" fill="${DARK}" opacity="0.35" transform="translate(-0.4 0.5)" />
    <ellipse data-lz="palm" fill="${LIMB}" stroke="${DARK}" stroke-width="0.4" stroke-opacity="0.55" />
    <path data-lz="toes-near" stroke="${LIMB}" stroke-width="1.5" stroke-linecap="round" fill="none" />
    <path data-lz="toes-far" stroke="${LIMB}" stroke-width="1.05" stroke-linecap="round" fill="none" />
    <path data-lz="claws" stroke="${CLAW}" stroke-width="0.75" stroke-linecap="round" fill="none" opacity="0.9" />
  </g>`;

const repeat = (n, make) => Array.from({ length: n }, (_, i) => make(i)).join("");

/** The whole tree, ready to be assigned to an `<svg>`'s innerHTML. */
export function lizardMarkup() {
  return `
<defs>
  <filter id="lz-shadow" x="-40%" y="-40%" width="180%" height="180%">
    <feGaussianBlur stdDeviation="2.6" />
  </filter>
  <filter id="lz-soft" x="-30%" y="-30%" width="160%" height="160%">
    <feGaussianBlur stdDeviation="1.1" />
  </filter>
  <filter id="lz-softer" x="-30%" y="-30%" width="160%" height="160%">
    <feGaussianBlur stdDeviation="1.9" />
  </filter>

  <!-- The silhouette, as a clip. Every layer of shading below is a copy of the
       body pushed a little one way or another and blurred, and this is what
       keeps all of it inside the skin. -->
  <clipPath id="lz-clip" clipPathUnits="userSpaceOnUse">
    <path data-lz="clip" />
  </clipPath>

  <!-- Moonlight, aimed each frame from the light's side of the animal. -->
  <linearGradient id="lz-rim" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="0" y2="0">
    <stop offset="0" stop-color="${MOON}" stop-opacity="0.9" />
    <stop offset="0.55" stop-color="${MOON}" stop-opacity="0" />
  </linearGradient>

  <radialGradient id="lz-eye" cx="40%" cy="36%">
    <stop offset="0%" stop-color="#d9b562" />
    <stop offset="55%" stop-color="#8f6420" />
    <stop offset="100%" stop-color="#2e1c07" />
  </radialGradient>

  <!-- Skin. Two sheets, both pinned to the body's centre and bearing every
       frame so they ride the animal: a fine mesh of scales, and a coarser
       reticulation of darker mottling underneath it. -->
  <pattern id="lz-scales" data-lz="tex" patternUnits="userSpaceOnUse" width="2.6" height="2.3">
    <path d="M 1.3 0.15 L 2.35 0.75 L 2.35 1.55 L 1.3 2.1 L 0.25 1.55 L 0.25 0.75 Z"
      fill="none" stroke="${RIDGE}" stroke-width="0.32" opacity="0.75" />
  </pattern>
  <pattern id="lz-mottle" data-lz="tex" patternUnits="userSpaceOnUse" width="11" height="9">
    <path d="M 1 2 C 2 0.5, 4 1, 4.5 2.5 C 5 4, 2.5 5, 1.5 4 C 0.5 3.4, 0.3 2.6, 1 2 Z" fill="${DARK}" opacity="0.6" />
    <path d="M 7 5.5 C 8.5 4.5, 10.5 5.5, 10 7 C 9.5 8.5, 7.5 8.6, 6.8 7.4 C 6.3 6.6, 6.4 6, 7 5.5 Z" fill="${DARK}" opacity="0.55" />
    <circle cx="6.2" cy="1.6" r="0.9" fill="${DARK}" opacity="0.45" />
    <circle cx="2.6" cy="7.6" r="0.7" fill="${DARK}" opacity="0.4" />
  </pattern>
</defs>

<!-- Everything that is the animal, so the whole of it can be hidden in one
     attribute while it is underground. -->
<g data-lz="animal">
  <!-- Cast down and to the left, because the light is up and to the right. A
       shadow that disagrees with the light unbuilds the whole illusion. It
       lengthens when the body rises on its legs. -->
  <g data-lz="shadow-seat" transform="translate(3.5 4.5)">
    <path data-lz="shadow" fill="#04060f" opacity="0.42" filter="url(#lz-shadow)" />
  </g>

  <!-- Limbs sit under the body so they emerge from beneath it. -->
  ${repeat(LEGS.length, leg)}

  <!-- The torso is scaled for push-ups; the legs above are not. -->
  <g data-lz="torso">
    <path data-lz="body" fill="${SAND}" stroke="${DARK}" stroke-width="0.6" stroke-opacity="0.5" />

    <g clip-path="url(#lz-clip)">
      <!-- The core shadow: the body pushed away from the light, blurred. -->
      <path data-lz="shade" fill="${DARK}" opacity="0.5" filter="url(#lz-softer)" transform="translate(-1.9 2.2)" />
      <!-- The darker back: a narrower body, softened at the edge. -->
      <path data-lz="back" fill="${BACK}" opacity="0.9" filter="url(#lz-soft)" />
      <rect data-lz="swatch" fill="url(#lz-mottle)" opacity="0.44" />

      ${repeat(
        10,
        (i) => `<path data-lz="mark" d="${MARKS[i % 3]}" fill="${DARK}" opacity="0.42" />`,
      )}
      ${repeat(
        6,
        () =>
          `<path data-lz="band" stroke="${DARK}" stroke-width="1.9" stroke-linecap="round" opacity="0.4" fill="none" />`,
      )}

      <!-- Two pale dorsolateral stripes, the way a wall lizard wears them. -->
      ${repeat(
        2,
        () =>
          `<path data-lz="stripe" stroke="${STRIPE}" stroke-width="0.9" fill="none" opacity="0.45" filter="url(#lz-soft)" />`,
      )}

      <!-- The ridge of the back catches the light. -->
      <path data-lz="ridge" fill="${RIDGE}" opacity="0.42" filter="url(#lz-soft)" transform="translate(0.7 -0.7)" />
      <path data-lz="chevrons" stroke="${DARK}" stroke-width="0.5" stroke-linejoin="round" fill="none" opacity="0.38" />
      <rect data-lz="swatch" fill="url(#lz-scales)" opacity="0.26" />

      <!-- Moonlight on the near edge. -->
      <path data-lz="rim" fill="none" stroke="url(#lz-rim)" stroke-width="2.6" filter="url(#lz-soft)" />
    </g>

    <g data-lz="head">
      <ellipse data-lz="throat" cx="-3.4" cy="0" rx="3.4" ry="2.5" fill="${SAND}" opacity="0.5" />

      <!-- The eyes sit in bulges. -->
      <ellipse cx="0.6" cy="-3.2" rx="2.9" ry="2.3" fill="${RIDGE}" opacity="0.3" />
      <ellipse cx="0.6" cy="3.2" rx="2.9" ry="2.3" fill="${RIDGE}" opacity="0.3" />

      <!-- Lip lines, with the labial scales ticked along them. -->
      <path d="M 5.4 -0.5 C 3.2 -2.9, 0.8 -4, -2.6 -4.1" stroke="${DARK}" stroke-width="0.55" fill="none" opacity="0.5" />
      <path d="M 5.4 0.5 C 3.2 2.9, 0.8 4, -2.6 4.1" stroke="${DARK}" stroke-width="0.55" fill="none" opacity="0.5" />
      <path d="M 4.2 -1.7 L 4.5 -2.2 M 2.9 -2.7 L 3.3 -3.2 M 1.4 -3.5 L 1.6 -4.1 M 4.2 1.7 L 4.5 2.2 M 2.9 2.7 L 3.3 3.2 M 1.4 3.5 L 1.6 4.1"
        stroke="${DARK}" stroke-width="0.4" opacity="0.4" />

      <ellipse cx="4.7" cy="-1" rx="0.42" ry="0.3" fill="${DARK}" opacity="0.75" />
      <ellipse cx="4.7" cy="1" rx="0.42" ry="0.3" fill="${DARK}" opacity="0.75" />

      <!-- Ear openings, behind the jaw. -->
      <ellipse cx="-3.6" cy="-4.2" rx="0.55" ry="0.95" fill="${DARK}" opacity="0.55" />
      <ellipse cx="-3.6" cy="4.2" rx="0.55" ry="0.95" fill="${DARK}" opacity="0.55" />

      <path data-lz="tongue" stroke="#c9636f" stroke-width="0.75" stroke-linecap="round" opacity="0" fill="none" />

      ${eye(-3.2, -1.2)}
      ${eye(3.2, 1.2)}
    </g>
  </g>
</g>

<!--
  The hole, drawn *over* the animal on purpose: what is inside a hole is not
  visible, so painting the opening on top is what hides the cut end of a body
  that is halfway into the ground. It fades out once the lizard has walked away
  from it, leaving nothing behind.
-->
<g data-lz="ground" opacity="0">
  <ellipse rx="16" ry="10" fill="#2b2114" opacity="0.5" />
  ${repeat(12, () => `<circle data-lz="grit" r="1.15" fill="#7a6238" opacity="0" />`)}
  <ellipse rx="${HOLE_RX}" ry="6.2" fill="#05070e" />
  <ellipse rx="${HOLE_RX + 1}" ry="7.1" fill="none" stroke="#6b5433" stroke-width="1.3" opacity="0.75" />
</g>

<!-- Prey. Two wings and a temper. -->
<g data-lz="fly" opacity="0">
  <ellipse rx="2" ry="1.25" fill="#12131a" />
  <ellipse data-lz="wing" cx="-0.4" cy="-1.7" rx="2.2" ry="0.9" fill="#cdd8ee" opacity="0.45" />
  <ellipse data-lz="wing" cx="-0.4" cy="1.7" rx="2.2" ry="0.9" fill="#cdd8ee" opacity="0.45" />
</g>`;
}
