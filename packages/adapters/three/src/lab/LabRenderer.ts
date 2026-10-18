import type { Matrix3 as CoreMatrix3, StitchingSetup } from '@gyroview/core';

import { BentJoinRenderer } from '../bentJoin/BentJoinRenderer';
import { applyLensPose } from '../rendererUniforms';
import type { ThreeFrameRendererOptions } from '../ThreeFrameRenderer';

/**
 * The renderer `pnpm measure` draws with: the bent join's renderer (ADR 0048), with the
 * instruments only the measurements turn. The player never links this module.
 */
export class LabRenderer extends BentJoinRenderer {
  public static override create(
    canvas: HTMLCanvasElement,
    setup: StitchingSetup,
    options: ThreeFrameRendererOptions = {},
  ): LabRenderer {
    const { parts, join } = this.open(canvas, setup, options);
    return new this(parts, canvas, join);
  }

  /**
   * Replaces one lens's body-to-lens rotation for every picture and meter from now on. Redraws the
   * frames on screen.
   */
  public setLensPose(lensIndex: number, rotation: CoreMatrix3): void {
    this.ensureLive();
    applyLensPose(this.uniforms, lensIndex, rotation);
    this.redraw();
  }
}
