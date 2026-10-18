import {
  degreesToRadians,
  SEAM_BIN_COLUMNS,
  SEAM_CELL_SUBSAMPLES,
  SEAM_STRIP_ROWS,
  SEAM_STRIP_STEP,
  SEAM_STRIP_THETA_START,
} from '@gyroview/core';

import { MISMATCH_ENCODING_DEFINES } from './seamMismatch/decodeBinCosts';
import { SEAM_JOIN_DEFINES } from './seamJoin';
import bentJoin from './shaders/bentJoin.glsl?raw';
import seamMismatchFragment from './shaders/seamMismatch.frag.glsl?raw';
import type { PictureShaders } from '../pictureMaterials';
import { SHADER_DEFINES, type ShaderDefines } from '../rendererUniforms';
import { chunksOf, lensProjectionProgram, pictureProgramsWith } from '../shaderPrograms';

/**
 * The constants of the seam strip the mismatch program samples.
 */
const SEAM_STRIP_DEFINES: readonly (readonly [string, number])[] = [
  ['SEAM_STRIP_ROWS', SEAM_STRIP_ROWS],
  ['SEAM_BIN_COLUMNS', SEAM_BIN_COLUMNS],
  ['SEAM_CELL_SUBSAMPLES', SEAM_CELL_SUBSAMPLES],
  ['SEAM_STRIP_STEP_RADIANS', degreesToRadians(SEAM_STRIP_STEP)],
  ['SEAM_STRIP_THETA_START_RADIANS', degreesToRadians(SEAM_STRIP_THETA_START)],
];

/**
 * Every constant the bent join's programs refer to: the player's, and the seam join's and seam
 * strip's.
 */
export const BENT_JOIN_DEFINES: ShaderDefines = {
  ...SHADER_DEFINES,
  ...Object.fromEntries([
    ...SEAM_JOIN_DEFINES,
    ...SEAM_STRIP_DEFINES,
    ...MISMATCH_ENCODING_DEFINES,
  ]),
};

/**
 * The pictures a bent join draws: the stitch through the bent seam join, whose fixed join draws
 * what the player draws.
 */
export const BENT_JOIN_SHADERS: PictureShaders = {
  programs: pictureProgramsWith(bentJoin),
  defines: BENT_JOIN_DEFINES,
};

/**
 * The seam strip's disagreement between the lenses for slides of lens 0's sampling.
 */
export const SEAM_MISMATCH = lensProjectionProgram(seamMismatchFragment);

/**
 * Every chunk of the bent join's programs once, for checking them against the TypeScript side.
 */
export const BENT_JOIN_CHUNKS = chunksOf([
  ...Object.values(BENT_JOIN_SHADERS.programs),
  SEAM_MISMATCH,
]);
