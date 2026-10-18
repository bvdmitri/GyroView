import { DEFAULT_MAX_GAIN } from './gainMatch';
import type { Vector3 } from '../../shared/math/Vector3';
import type { Seconds } from '../../shared/units/time';

/**
 * Directions the seam meter reads around the seam ring, evenly from lens 0's x towards its y:
 * the field holds a ratio for each.
 */
export const SEAM_COLOUR_DIRECTIONS = 64;
/**
 * The spread of the Gaussian the ratios are smoothed with around the ring, in directions: about
 * 17 degrees, wide enough to carry a ratio across a direction a jumper's body hides.
 */
const SMOOTHING_SPREAD = 3;
/**
 * What a direction without a measurement weighs towards no correction, against one measured
 * direction: little, so a measured ratio holds across its neighbours, yet enough that far from
 * any measurement the lenses are left as they are.
 */
const UNMEASURED_WEIGHT = 0.01;
/**
 * The smoothing Gaussian's reach, in spreads.
 */
const SMOOTHING_REACH = 3;
/**
 * A channel darker than this (0..1) carries no exposure information, as in gain matching.
 */
const DARK_CHANNEL = 0.01;
const TIME_CONSTANT_SECONDS = 1.5;
const CHANNELS = 3;

/**
 * What lens 0 and lens 1 show in one direction around the seam ring, or undefined where the
 * meter could not compare them there (not imaged by both, or blown out).
 */
export type SeamDirectionColours = readonly [Vector3, Vector3] | undefined;

/**
 * The colour lens 1 shows against lens 0 in each direction around the seam ring, once the lens
 * gains are applied: per channel, lens 1's over lens 0's, smoothed around the ring (ADR 0048).
 * A ratio of one in every channel is no correction. Each is held within the gain matching's
 * limit: beyond it the lenses disagree about content, not exposure. Directions far from any the
 * lenses could be compared in keep a ratio of one.
 */
export function seamColourFieldOf(
  around: readonly SeamDirectionColours[],
  gains: readonly Vector3[],
): Vector3[] {
  const logs = around.map((colours) => logRatiosOf(colours, gains));
  return Array.from({ length: SEAM_COLOUR_DIRECTIONS }, (_, direction) =>
    smoothedRatioAt(logs, direction),
  );
}

/**
 * Follows the seam colour field over time as gain matching follows its gains: the first field
 * as it is, each later one eased towards over a 1.5-second time constant, in the ratios'
 * logarithms so that a ratio and its inverse ease alike.
 */
export class SeamColourMatcher {
  private current: Vector3[] | undefined;
  private lastTime: Seconds | undefined;

  public update(
    around: readonly SeamDirectionColours[],
    gains: readonly Vector3[],
    time: Seconds,
  ): readonly Vector3[] {
    const target = seamColourFieldOf(around, gains);
    const elapsed = this.lastTime === undefined ? Infinity : Math.max(time - this.lastTime, 0);
    this.lastTime = time;
    const previous = this.current;
    const share = previous ? 1 - Math.exp(-elapsed / TIME_CONSTANT_SECONDS) : 1;
    this.current = target.map((ratio, direction) =>
      easedRatio(previous?.[direction] ?? ratio, ratio, share),
    );
    return this.current;
  }
}

/**
 * Per channel, the logarithm of lens 1's colour over lens 0's after their gains, held within the
 * gain limit; undefined in a channel either lens shows too dark, and in a direction not compared.
 */
function logRatiosOf(
  colours: SeamDirectionColours,
  gains: readonly Vector3[],
): (number | undefined)[] | undefined {
  if (!colours) return undefined;
  const [lens0, lens1] = colours;
  const limit = Math.log(DEFAULT_MAX_GAIN);
  return Array.from({ length: CHANNELS }, (_, channel) => {
    const zero = gained(lens0, gains[0], channel);
    const one = gained(lens1, gains[1], channel);
    return zero > DARK_CHANNEL && one > DARK_CHANNEL
      ? Math.min(Math.max(Math.log(one / zero), -limit), limit)
      : undefined;
  });
}

function gained(colour: Vector3, gain: Vector3 | undefined, channel: number): number {
  return (colour[channel] ?? 0) * (gain?.[channel] ?? 1);
}

/**
 * The ratio at a direction: a Gaussian around the ring over the directions measured in each
 * channel, weighed against no correction where little is measured nearby.
 */
function smoothedRatioAt(
  logs: readonly ((number | undefined)[] | undefined)[],
  direction: number,
): Vector3 {
  const reach = Math.ceil(SMOOTHING_SPREAD * SMOOTHING_REACH);
  const channel = (index: number): number => {
    let sum = 0;
    let weightSum = UNMEASURED_WEIGHT;
    for (let offset = -reach; offset <= reach; offset += 1) {
      const around = (direction + offset + SEAM_COLOUR_DIRECTIONS) % SEAM_COLOUR_DIRECTIONS;
      const value = logs[around]?.[index];
      if (value === undefined) continue;
      const weight = Math.exp(-(offset * offset) / (2 * SMOOTHING_SPREAD * SMOOTHING_SPREAD));
      sum += weight * value;
      weightSum += weight;
    }
    return Math.exp(sum / weightSum);
  };
  return [channel(0), channel(1), channel(2)];
}

function easedRatio(from: Vector3, to: Vector3, share: number): Vector3 {
  const eased = (index: number): number => {
    const before = Math.log(from[index] ?? 1);
    return Math.exp(before + (Math.log(to[index] ?? 1) - before) * share);
  };
  return [eased(0), eased(1), eased(2)];
}
