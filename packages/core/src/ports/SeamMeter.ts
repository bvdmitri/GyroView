import type { SeamDirectionColours } from '../domain/colour/seamColour';
import type { Vector3 } from '../shared/math/Vector3';

/**
 * What one measurement reads along the seam of the frames on screen.
 */
export interface SeamReading {
  /**
   * A mean colour (0..1 per channel) per lens in lens order, over the directions every lens
   * images and none shows blown out.
   */
  readonly means: readonly Vector3[];
  /**
   * Each of the `SEAM_COLOUR_DIRECTIONS` directions around the ring, as lens 0 and lens 1 show
   * it; undefined in a direction they cannot be compared in, and in every direction for a
   * camera of another lens count.
   */
  readonly around: readonly SeamDirectionColours[];
}

/**
 * Port: measures what each lens shows along the seam of the frames on screen; undefined when no
 * direction is left that every lens images unclipped, or the picture could not be read back this
 * time.
 */
export interface SeamMeter {
  measure(): Promise<SeamReading | undefined>;
  dispose(): void;
}
