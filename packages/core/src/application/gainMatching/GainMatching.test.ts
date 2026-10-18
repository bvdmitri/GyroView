import { describe, expect, it } from 'vitest';

import { GainMatching } from './GainMatching';
import { Deferred } from '../../shared/async/Deferred';
import type { Vector3 } from '../../shared/math/Vector3';
import { seconds } from '../../shared/units/time';
import type { SeamMeter, SeamReading } from '../../ports/SeamMeter';
import {
  SEAM_COLOUR_DIRECTIONS,
  SeamColourMatcher,
  type SeamDirectionColours,
} from '../../domain/colour/seamColour';

const BRIGHT_AND_DARK_MEANS: readonly Vector3[] = [
  [0.8, 0.8, 0.8],
  [0.4, 0.4, 0.4],
];
/**
 * Lens 1 half as bright as lens 0 on one half of the ring, a third as bright on the other: one
 * gain for the whole seam leaves a difference around it.
 */
const UNEVEN: readonly SeamDirectionColours[] = Array.from(
  { length: SEAM_COLOUR_DIRECTIONS },
  (_, direction) => [
    [0.6, 0.6, 0.6],
    direction < SEAM_COLOUR_DIRECTIONS / 2 ? [0.3, 0.3, 0.3] : [0.2, 0.2, 0.2],
  ],
);
const BRIGHT_AND_DARK: SeamReading = { means: BRIGHT_AND_DARK_MEANS, around: UNEVEN };

/**
 * A meter under the test's control: each measurement waits until the test answers it.
 */
class ControlledMeter implements SeamMeter {
  public readonly pending: Deferred<SeamReading | undefined>[] = [];
  public isDisposed = false;

  public measure(): Promise<SeamReading | undefined> {
    const answer = new Deferred<SeamReading | undefined>();
    this.pending.push(answer);
    return answer.promise;
  }

  public dispose(): void {
    this.isDisposed = true;
  }
}

function matching(): {
  meter: ControlledMeter;
  applied: (readonly Vector3[])[];
  colours: (readonly Vector3[])[];
  subject: GainMatching;
} {
  const meter = new ControlledMeter();
  const applied: (readonly Vector3[])[] = [];
  const colours: (readonly Vector3[])[] = [];
  const subject = new GainMatching({
    meter,
    referenceLens: 0,
    applyGains: (gains): void => {
      applied.push(gains);
    },
    applySeamColours: (field): void => {
      colours.push(field);
    },
  });
  return { meter, applied, colours, subject };
}

function ignoreGains(): void {
  // The test watches the meter, not the gains.
}

describe('GainMatching', () => {
  it('measures after the first presented frame and applies the gains the matcher gives', async () => {
    const { meter, applied, subject } = matching();
    subject.afterPresent(seconds(0));
    meter.pending[0]?.resolve(BRIGHT_AND_DARK);
    await subject.matchNow(seconds(0));
    expect(applied).toHaveLength(1);
    expect(applied[0]?.[1]?.[0]).toBeGreaterThan(1);
  });

  it('applies the colour left between the lenses around the seam, at the gains it applies', async () => {
    const { meter, applied, colours, subject } = matching();
    subject.afterPresent(seconds(0));
    meter.pending[0]?.resolve(BRIGHT_AND_DARK);
    await subject.matchNow(seconds(0));
    expect(colours).toEqual([new SeamColourMatcher().update(UNEVEN, applied[0] ?? [], seconds(0))]);
  });

  it('measures again only once half a second of media has passed', async () => {
    const { meter, subject } = matching();
    subject.afterPresent(seconds(0));
    meter.pending[0]?.resolve(BRIGHT_AND_DARK);
    await subject.matchNow(seconds(0));
    subject.afterPresent(seconds(0.2));
    expect(meter.pending).toHaveLength(1);
    subject.afterPresent(seconds(0.6));
    expect(meter.pending).toHaveLength(2);
  });

  it('joins a measurement already under way instead of starting another', () => {
    const { meter, subject } = matching();
    subject.afterPresent(seconds(0));
    void subject.matchNow(seconds(0));
    expect(meter.pending).toHaveLength(1);
  });

  it('applies nothing when the seam could not be measured', async () => {
    const { meter, applied, subject } = matching();
    const measured = subject.matchNow(seconds(0));
    meter.pending[0]?.resolve(undefined);
    await measured;
    expect(applied).toEqual([]);
  });

  it('stops matching when the meter fails, and reports that once', async () => {
    const meter = new ControlledMeter();
    const failures: unknown[] = [];
    const subject = new GainMatching({
      meter,
      referenceLens: 0,
      applyGains: ignoreGains,
      reportFailure: (error): void => {
        failures.push(error);
      },
    });
    subject.afterPresent(seconds(0));
    meter.pending[0]?.reject(new Error('read-back failed'));
    await Promise.resolve();
    await Promise.resolve();
    for (let time = 0.1; time < 2; time += 0.1) subject.afterPresent(seconds(time));
    expect(meter.pending).toHaveLength(1);
    expect(failures).toEqual([new Error('read-back failed')]);
  });

  it('ignores a measurement that lands after it stopped, and leaves the meter to its owner', async () => {
    const { meter, applied, subject } = matching();
    const measured = subject.matchNow(seconds(0));
    subject.stop();
    meter.pending[0]?.resolve(BRIGHT_AND_DARK);
    await measured;
    expect(applied).toEqual([]);
    expect(meter.isDisposed).toBe(false);
  });
});
