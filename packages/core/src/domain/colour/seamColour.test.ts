import { describe, expect, it } from 'vitest';

import {
  SEAM_COLOUR_DIRECTIONS,
  SeamColourMatcher,
  seamColourFieldOf,
  type SeamDirectionColours,
} from './seamColour';
import type { Vector3 } from '../../shared/math/Vector3';
import { seconds } from '../../shared/units/time';

const UNIT: Vector3 = [1, 1, 1];
const GAINS: readonly Vector3[] = [UNIT, UNIT];

/**
 * Every direction around the ring seen by both lenses as `colourAt` its index says.
 */
function around(
  colourAt: (direction: number) => readonly [Vector3, Vector3] | undefined,
): SeamDirectionColours[] {
  return Array.from({ length: SEAM_COLOUR_DIRECTIONS }, (_, direction) => colourAt(direction));
}

function expectVector(actual: Vector3 | undefined, expected: Vector3, digits = 3): void {
  for (const [channel, value] of expected.entries()) {
    expect(actual?.[channel]).toBeCloseTo(value, digits);
  }
}

describe('seamColourFieldOf', () => {
  it('is the ratio of lens 1 to lens 0 in every direction, after the lens gains', () => {
    const field = seamColourFieldOf(
      around(() => [
        [0.2, 0.4, 0.6],
        [0.3, 0.4, 0.3],
      ]),
      [UNIT, [1, 1, 2]],
    );
    expect(field).toHaveLength(SEAM_COLOUR_DIRECTIONS);
    // The pull towards no correction where nothing is measured moves it by a thousandth.
    expectVector(field[10], [1.5, 1, 1], 2);
  });

  it('follows a ratio that changes around the ring, smoothed', () => {
    // Lens 1 brighter on one half of the ring, matched on the other.
    const field = seamColourFieldOf(
      around((direction) => [
        [0.4, 0.4, 0.4],
        direction < SEAM_COLOUR_DIRECTIONS / 2 ? [0.6, 0.6, 0.6] : [0.4, 0.4, 0.4],
      ]),
      GAINS,
    );
    expectVector(field[SEAM_COLOUR_DIRECTIONS / 4], [1.5, 1.5, 1.5], 2);
    expectVector(field[(3 * SEAM_COLOUR_DIRECTIONS) / 4], UNIT, 2);
    // Between them it passes smoothly, neither step nor overshoot.
    const edge = field[SEAM_COLOUR_DIRECTIONS / 2]?.[0] ?? 0;
    expect(edge).toBeGreaterThan(1.05);
    expect(edge).toBeLessThan(1.45);
  });

  it('corrects nothing far from any direction both lenses show, and nothing in a dark channel', () => {
    const field = seamColourFieldOf(
      around((direction) =>
        direction < 4
          ? [
              [0.4, 0.4, 0.001],
              [0.6, 0.6, 0.004],
            ]
          : undefined,
      ),
      GAINS,
    );
    expectVector(field[2], [1.5, 1.5, 1], 1);
    expectVector(field[SEAM_COLOUR_DIRECTIONS / 2], UNIT);
  });

  it('holds a ratio to the largest gain, beyond which it is content and not exposure', () => {
    const field = seamColourFieldOf(
      around(() => [
        [0.1, 0.1, 0.1],
        [0.9, 0.9, 0.9],
      ]),
      GAINS,
    );
    expectVector(field[0], [2, 2, 2], 2);
  });

  it('is no correction at all when no direction is seen by both lenses', () => {
    const field = seamColourFieldOf(
      Array.from<SeamDirectionColours>({ length: SEAM_COLOUR_DIRECTIONS }),
      GAINS,
    );
    expect(field.every((ratio) => ratio.every((channel) => channel === 1))).toBe(true);
  });
});

describe('SeamColourMatcher', () => {
  it('takes the first field as it is, then follows later ones over the time between them', () => {
    const brighter = around(() => [
      [0.4, 0.4, 0.4],
      [0.6, 0.6, 0.6],
    ]);
    const matched = around(() => [
      [0.4, 0.4, 0.4],
      [0.4, 0.4, 0.4],
    ]);
    const matcher = new SeamColourMatcher();
    expectVector(matcher.update(brighter, GAINS, seconds(0))[0], [1.5, 1.5, 1.5], 2);
    const later = matcher.update(matched, GAINS, seconds(1.5))[0]?.[0] ?? 0;
    // One time constant on, a little over a third of the way back, in the ratio's logarithm.
    expect(later).toBeCloseTo(Math.exp(Math.log(1.5) * Math.exp(-1)), 2);
  });
});
