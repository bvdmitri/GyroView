import {
  degrees,
  degreesToRadians,
  ensureInvariant,
  SEAM_COLOUR_DIRECTIONS,
  type Vector3 as CoreVector3,
} from '@gyroview/core';
import { Vector3, type IUniform } from 'three';

import { glslFloat } from './glslLiterals';

/**
 * How far either side of the seam ring a lens is drawn towards the halfway colour, the
 * correction fading to nothing there: wide, so the lenses' difference spreads over a quarter of
 * the sphere rather than showing as a band (ADR 0048).
 */
const SEAM_COLOUR_FADE_DEGREES = 45;

/**
 * The constants the stitch's seam colour reads, as preprocessor defines.
 */
export const SEAM_COLOUR_DEFINES: readonly (readonly [string, number | string])[] = [
  ['SEAM_COLOUR_DIRECTIONS', SEAM_COLOUR_DIRECTIONS],
  ['SEAM_COLOUR_FADE_RADIANS', glslFloat(degreesToRadians(degrees(SEAM_COLOUR_FADE_DEGREES)))],
];

/**
 * The seam's colour field: whether it applies, and per direction around the ring the colour
 * lens 1 shows against lens 0 after the gains.
 */
export interface SeamColourUniforms {
  readonly uSeamColoured: IUniform<boolean>;
  readonly uSeamRatio: IUniform<Vector3[]>;
}

/**
 * No field: the lenses drawn as the gains leave them.
 */
export function createSeamColourUniforms(): SeamColourUniforms {
  return {
    uSeamColoured: { value: false },
    uSeamRatio: {
      value: Array.from({ length: SEAM_COLOUR_DIRECTIONS }, () => new Vector3(1, 1, 1)),
    },
  };
}

/**
 * Sets the seam's colour field, one positive ratio per channel in each direction, or takes it
 * away; any other field is refused.
 */
export function applySeamColours(
  uniforms: SeamColourUniforms,
  field: readonly CoreVector3[] | undefined,
): void {
  if (!field) {
    uniforms.uSeamColoured.value = false;
    return;
  }
  ensureInvariant(
    field.length === SEAM_COLOUR_DIRECTIONS,
    `${field.length} seam colours for ${SEAM_COLOUR_DIRECTIONS} directions`,
  );
  ensureInvariant(
    field.every((ratio) => ratio.every((channel) => channel > 0 && Number.isFinite(channel))),
    'a seam colour ratio is not a positive number',
  );
  for (const [direction, ratio] of field.entries()) {
    uniforms.uSeamRatio.value[direction]?.set(...ratio);
  }
  uniforms.uSeamColoured.value = true;
}
