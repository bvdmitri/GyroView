import { DEFAULT_MAX_GAIN, gainsMatching } from '../../domain/colour/gainMatch';
import { binDisparitiesOf, slidesOf } from '../../domain/stitching/seamDisparity';
import { disparityFieldOf, easedDisparities } from '../../domain/stitching/seamDisparityField';
import type { SeamAlignment } from '../../domain/stitching/seamJoin';
import type { SeamMeter } from '../../ports/SeamMeter';
import type { SeamMismatchMeter } from '../../ports/SeamMismatchMeter';
import type { Degrees } from '../../shared/units/angle';
import { seconds, type Seconds } from '../../shared/units/time';

/**
 * What the bending draws through: the bent join's renderer, its meters over the frames on screen.
 */
export interface SeamBendingRenderer {
  setSeamAlignment(alignment: SeamAlignment): void;
  createSeamMeter(): SeamMeter;
  createSeamMismatchMeter(): SeamMismatchMeter;
}

export interface SeamBendingParts {
  readonly renderer: SeamBendingRenderer;
  /**
   * The lens whose exposure the lenses are compared at (`referenceLensOf`).
   */
  readonly referenceLens: number;
}

/**
 * Use case: bends the seam join by the disparity measured on each frame (ADR 0026, ADR 0048).
 * For each frame on screen it matches the lenses' exposure along the seam, measures how far lens
 * 0 must slide across the ring to agree with lens 1 in every bin, eases that field from the one
 * shown before as the player would, and draws the bent join by it. A measurement takes tens of
 * milliseconds, so a rendition can afford one a frame and a player cannot.
 */
export class SeamBending {
  private readonly seamMeter: SeamMeter;
  private readonly mismatchMeter: SeamMismatchMeter;
  private shown: { readonly field: readonly Degrees[]; readonly time: Seconds } | undefined;

  public constructor(private readonly parts: SeamBendingParts) {
    this.seamMeter = parts.renderer.createSeamMeter();
    this.mismatchMeter = parts.renderer.createSeamMismatchMeter();
  }

  /**
   * Measures the frames on screen, shown at `time`, and bends the join by their disparity eased
   * from the field shown before. A seam with nothing both lenses show unclipped, or a strip
   * that could not be read, leaves the join as it was.
   */
  public async bendAt(time: Seconds): Promise<void> {
    const means = await this.seamMeter.measure();
    if (!means) return;
    const gains = gainsMatching(means, DEFAULT_MAX_GAIN, this.parts.referenceLens);
    const costs = await this.mismatchMeter.measure({ slides: slidesOf(), gains });
    if (!costs) return;
    const measured = disparityFieldOf(binDisparitiesOf(costs));
    const field = this.shown
      ? easedDisparities(this.shown.field, measured, seconds(time - this.shown.time))
      : measured;
    this.shown = { field, time };
    this.parts.renderer.setSeamAlignment({ join: 'bent', disparities: field });
  }

  public dispose(): void {
    this.seamMeter.dispose();
    this.mismatchMeter.dispose();
  }
}
