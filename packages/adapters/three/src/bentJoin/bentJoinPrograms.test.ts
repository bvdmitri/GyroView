import { DataTexture } from 'three';
import { describe, it } from 'vitest';

import { BENT_JOIN_CHUNKS, BENT_JOIN_DEFINES } from './bentJoinPrograms';
import { createSeamJoinUniforms } from './seamJoin';
import { createSeamMismatchUniforms } from './seamMismatch/SeamMismatchPass';
import { SEAM_ANALYSIS } from '../shaderPrograms';
import { baseUniforms, declaredIn, expectBound, expectDefinesRead } from '../test/shaderContract';

describe('the bent join’s programs', () => {
  it('bind exactly the uniforms they declare, which extend the shared ones', () => {
    const uniforms = {
      ...createSeamMismatchUniforms(baseUniforms(), new DataTexture()),
      ...createSeamJoinUniforms(),
    };
    expectBound(declaredIn([BENT_JOIN_CHUNKS, SEAM_ANALYSIS]), Object.keys(uniforms));
  });

  it('are given only defines a chunk reads, so no constant is dead on one side', () => {
    expectDefinesRead(BENT_JOIN_DEFINES, BENT_JOIN_CHUNKS);
  });
});
