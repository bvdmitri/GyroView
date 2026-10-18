import { describe, expect, it } from 'vitest';

import { SeamBending } from './SeamBending';
import { DEFAULT_MAX_GAIN, gainsMatching } from '../../domain/colour/gainMatch';
import { binDisparitiesOf, slidesOf } from '../../domain/stitching/seamDisparity';
import { disparityFieldOf, easedDisparities } from '../../domain/stitching/seamDisparityField';
import type { SeamAlignment } from '../../domain/stitching/seamJoin';
import type { SeamBinCosts } from '../../domain/stitching/seamMismatch';
import { SEAM_BIN_COUNT } from '../../domain/stitching/seamStrip';
import type { SeamMeter } from '../../ports/SeamMeter';
import type { SeamMismatchMeter, SeamMismatchRequest } from '../../ports/SeamMismatchMeter';
import type { Vector3 } from '../../shared/math/Vector3';
import { seconds } from '../../shared/units/time';

const FLOOR_COST = 0.01;
const MEANS: Vector3[] = [
  [0.4, 0.5, 0.6],
  [0.5, 0.5, 0.5],
];

/**
 * Costs that rise as a bowl from `disparity` in every bin, every bin imaged by both lenses.
 */
function bowlAt(disparity: number): SeamBinCosts[] {
  return slidesOf().map((slide) =>
    Array.from({ length: SEAM_BIN_COUNT }, () => ({
      mismatch: FLOOR_COST + (slide - disparity) ** 2,
      validity: 1,
    })),
  );
}

class FakeRenderer {
  public readonly alignments: SeamAlignment[] = [];
  public readonly requests: SeamMismatchRequest[] = [];
  public disposed = 0;

  public constructor(
    private readonly costs: (SeamBinCosts[] | undefined)[],
    private readonly isSeamComparable = true,
  ) {}

  public setSeamAlignment(alignment: SeamAlignment): void {
    this.alignments.push(alignment);
  }

  public createSeamMeter(): SeamMeter {
    return {
      measure: (): Promise<Vector3[] | undefined> =>
        Promise.resolve(this.isSeamComparable ? MEANS : undefined),
      dispose: (): void => {
        this.disposed += 1;
      },
    };
  }

  public createSeamMismatchMeter(): SeamMismatchMeter {
    return {
      measure: (request): Promise<SeamBinCosts[] | undefined> => {
        this.requests.push(request);
        return Promise.resolve(this.costs.shift());
      },
      dispose: (): void => {
        this.disposed += 1;
      },
    };
  }
}

function fieldOf(costs: SeamBinCosts[]): ReturnType<typeof disparityFieldOf> {
  return disparityFieldOf(binDisparitiesOf(costs));
}

describe('SeamBending', () => {
  it('bends the join by the disparity measured on the frames on screen', async () => {
    const renderer = new FakeRenderer([bowlAt(2)]);
    const bending = new SeamBending({ renderer, referenceLens: 0 });
    await bending.bendAt(seconds(1));
    expect(renderer.alignments).toEqual([{ join: 'bent', disparities: fieldOf(bowlAt(2)) }]);
  });

  it('eases each measurement from the field shown before, over the time between them', async () => {
    const renderer = new FakeRenderer([bowlAt(2), bowlAt(0)]);
    const bending = new SeamBending({ renderer, referenceLens: 0 });
    await bending.bendAt(seconds(1));
    await bending.bendAt(seconds(1.1));
    const shown = fieldOf(bowlAt(2));
    const measured = fieldOf(bowlAt(0));
    expect(renderer.alignments[1]).toEqual({
      join: 'bent',
      disparities: easedDisparities(shown, measured, seconds(1.1 - 1)),
    });
  });

  it('compares the lenses at the gains that match their exposure along the seam', async () => {
    const renderer = new FakeRenderer([bowlAt(1)]);
    const bending = new SeamBending({ renderer, referenceLens: 1 });
    await bending.bendAt(seconds(0));
    expect(renderer.requests).toEqual([
      { slides: slidesOf(), gains: gainsMatching(MEANS, DEFAULT_MAX_GAIN, 1) },
    ]);
  });

  it('keeps the join it has when the seam strip could not be read', async () => {
    const renderer = new FakeRenderer([bowlAt(2), undefined]);
    const bending = new SeamBending({ renderer, referenceLens: 0 });
    await bending.bendAt(seconds(1));
    await bending.bendAt(seconds(1.1));
    expect(renderer.alignments).toHaveLength(1);
  });

  it('keeps the join it has when no part of the seam could be compared', async () => {
    const renderer = new FakeRenderer([bowlAt(2)], false);
    const bending = new SeamBending({ renderer, referenceLens: 0 });
    await bending.bendAt(seconds(1));
    expect(renderer.alignments).toEqual([]);
    expect(renderer.requests).toEqual([]);
  });

  it('lets go of both meters when disposed', () => {
    const renderer = new FakeRenderer([]);
    new SeamBending({ renderer, referenceLens: 0 }).dispose();
    expect(renderer.disposed).toBe(2);
  });
});
