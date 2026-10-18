import { describe, expect, it } from 'vitest';

import { rowMeansOf, seamReadingOf } from './rowMeans';

const OPAQUE = 255;
const NOT_IMAGED = 0;

describe('rowMeansOf', () => {
  it('averages each row over the directions every row images', () => {
    const pixels = Uint8Array.from([
      // row 0: three imaged texels
      200,
      0,
      0,
      OPAQUE,
      100,
      0,
      0,
      OPAQUE,
      9,
      9,
      9,
      OPAQUE,
      // row 1: the third direction not imaged, so it counts for neither row
      100,
      128,
      128,
      OPAQUE,
      50,
      128,
      128,
      OPAQUE,
      9,
      9,
      9,
      NOT_IMAGED,
    ]);
    const means = rowMeansOf(pixels, 3, 2);
    expect(means?.[0]?.[0]).toBeCloseTo(150 / 255, 6);
    expect(means?.[0]?.[1]).toBe(0);
    expect(means?.[1]).toEqual([75 / 255, 128 / 255, 128 / 255]);
  });

  it('leaves out the directions any row shows blown out, in every row', () => {
    const pixels = Uint8Array.from([
      // row 0: the first direction flared in one channel
      255,
      120,
      120,
      OPAQUE,
      100,
      100,
      100,
      OPAQUE,
      // row 1: as the other lens sees the same two directions
      150,
      60,
      60,
      OPAQUE,
      50,
      50,
      50,
      OPAQUE,
    ]);
    expect(rowMeansOf(pixels, 2, 2)).toEqual([
      [100 / 255, 100 / 255, 100 / 255],
      [50 / 255, 50 / 255, 50 / 255],
    ]);
  });

  it('gives up when no direction is left to compare', () => {
    const imagedByOneRow = Uint8Array.from([128, 128, 128, OPAQUE, 0, 0, 0, NOT_IMAGED]);
    expect(rowMeansOf(imagedByOneRow, 1, 2)).toBeUndefined();
    const blownInOneRow = Uint8Array.from([255, 255, 255, OPAQUE, 128, 128, 128, OPAQUE]);
    expect(rowMeansOf(blownInOneRow, 1, 2)).toBeUndefined();
  });
});

describe('seamReadingOf', () => {
  it("reads both lenses' colour in each direction they can be compared in, beside the means", () => {
    const pixels = Uint8Array.from([
      // lens 0: two imaged texels, the second blown out
      102,
      51,
      51,
      OPAQUE,
      255,
      255,
      255,
      OPAQUE,
      // lens 1
      51,
      102,
      51,
      OPAQUE,
      10,
      10,
      10,
      OPAQUE,
    ]);
    const reading = seamReadingOf(pixels, 2, 2);
    expect(reading?.means[0]?.[0]).toBeCloseTo(102 / 255, 6);
    expect(reading?.around).toEqual([
      [
        [102 / 255, 51 / 255, 51 / 255],
        [51 / 255, 102 / 255, 51 / 255],
      ],
      undefined,
    ]);
  });

  it('compares no direction for a camera of another lens count', () => {
    const pixels = Uint8Array.from([102, 51, 51, OPAQUE]);
    expect(seamReadingOf(pixels, 1, 1)?.around).toEqual([undefined]);
  });

  it('reads nothing when no direction can be compared', () => {
    const pixels = Uint8Array.from([102, 51, 51, NOT_IMAGED, 51, 102, 51, OPAQUE]);
    expect(seamReadingOf(pixels, 1, 2)).toBeUndefined();
  });
});
