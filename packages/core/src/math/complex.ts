/**
 * Complex-number helpers.
 *
 * QFabric stores state vectors and gate matrices as flat `Float64Array`s of
 * interleaved `[real, imag]` pairs, which avoids per-amplitude
 * object allocation in hot paths. `Complex` is used only at the API surface
 * (reading a single amplitude, formatting), never inside inner loops.
 */

export interface Complex {
  re: number;
  im: number;
}

export const c = (re: number, im = 0): Complex => ({ re, im });

export const cAdd = (a: Complex, b: Complex): Complex => ({ re: a.re + b.re, im: a.im + b.im });

export const cMul = (a: Complex, b: Complex): Complex => ({
  re: a.re * b.re - a.im * b.im,
  im: a.re * b.im + a.im * b.re,
});

/** Squared magnitude |z|² = re² + im². */
export const cAbs2 = (z: Complex): number => z.re * z.re + z.im * z.im;

/** Magnitude |z|. */
export const cAbs = (z: Complex): number => Math.hypot(z.re, z.im);

/** Phase arg(z) in radians, (-π, π]. */
export const cArg = (z: Complex): number => Math.atan2(z.im, z.re);

/** e^{iθ} = cos θ + i sin θ. */
export const cExp = (theta: number): Complex => ({ re: Math.cos(theta), im: Math.sin(theta) });
