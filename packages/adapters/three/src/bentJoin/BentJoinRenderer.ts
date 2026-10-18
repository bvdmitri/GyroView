import type { SeamAlignment, SeamMismatchMeter, StitchingSetup } from '@gyroview/core';

import { BENT_JOIN_SHADERS } from './bentJoinPrograms';
import { applySeamAlignment, createSeamJoinUniforms, type SeamJoinUniforms } from './seamJoin';
import { SeamMismatchPass } from './seamMismatch/SeamMismatchPass';
import { openRendererParts, type RendererParts } from '../rendererParts';
import { ThreeFrameRenderer, type ThreeFrameRendererOptions } from '../ThreeFrameRenderer';

/**
 * The player's renderer with the bent seam join (ADR 0026, ADR 0048): each lens read across the
 * seam by half the disparity measured there, so a near object crossing the seam is drawn single.
 * Under the fixed join it draws what the player's renderer draws. A rendition draws through it,
 * since it can wait for the disparity measured every frame; the player cannot, and keeps the
 * fixed join.
 */
export class BentJoinRenderer extends ThreeFrameRenderer {
  protected constructor(
    parts: RendererParts,
    canvas: HTMLCanvasElement,
    private readonly join: SeamJoinUniforms,
  ) {
    super(parts, canvas);
  }

  public static override create(
    canvas: HTMLCanvasElement,
    setup: StitchingSetup,
    options: ThreeFrameRendererOptions = {},
  ): BentJoinRenderer {
    const { parts, join } = this.open(canvas, setup, options);
    return new this(parts, canvas, join);
  }

  /**
   * The renderer's parts drawing through the bent join's programs, and the join's own uniforms,
   * for this class's `create` and a subclass's.
   */
  protected static open(
    canvas: HTMLCanvasElement,
    setup: StitchingSetup,
    options: ThreeFrameRendererOptions,
  ): { readonly parts: RendererParts; readonly join: SeamJoinUniforms } {
    const join = createSeamJoinUniforms();
    const pictures = { shaders: BENT_JOIN_SHADERS, uniforms: { ...join } };
    return { parts: openRendererParts(canvas, setup, { options, pictures }), join };
  }

  /**
   * How the stitched pictures join the lenses at the seam, and the disparity a bent join bends
   * by. Redraws the frames on screen.
   */
  public setSeamAlignment(alignment: SeamAlignment): void {
    this.ensureLive();
    applySeamAlignment(this.join, alignment);
    this.redraw();
  }

  /**
   * A meter of how the lenses disagree along the seam strip of the frames on screen, for slides
   * of lens 0's sampling across the ring. Whoever creates it disposes it; the renderer disposes
   * any still live when it is disposed itself.
   */
  public createSeamMismatchMeter(): SeamMismatchMeter {
    this.ensureLive();
    const pass = new SeamMismatchPass(this.webgl, this.uniforms);
    return this.tracked({
      measure: (request) => pass.measure(request),
      dispose: () => {
        pass.dispose();
      },
    });
  }
}
