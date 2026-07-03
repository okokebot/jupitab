// 音価の厳密計算用の最小限の分数演算。den は常に正、常に既約。

export interface Fraction {
  num: number
  den: number
}

function gcd(a: number, b: number): number {
  a = Math.abs(a)
  b = Math.abs(b)
  while (b !== 0) {
    ;[a, b] = [b, a % b]
  }
  return a
}

export function frac(num: number, den = 1): Fraction {
  if (den === 0) throw new Error('Fraction: division by zero')
  if (den < 0) {
    num = -num
    den = -den
  }
  const g = gcd(num, den) || 1
  return { num: num / g, den: den / g }
}

export const ZERO: Fraction = { num: 0, den: 1 }

export function add(a: Fraction, b: Fraction): Fraction {
  return frac(a.num * b.den + b.num * a.den, a.den * b.den)
}

export function mul(a: Fraction, b: Fraction): Fraction {
  return frac(a.num * b.num, a.den * b.den)
}

export function cmp(a: Fraction, b: Fraction): number {
  return a.num * b.den - b.num * a.den
}

export function eq(a: Fraction, b: Fraction): boolean {
  return cmp(a, b) === 0
}

export function toNumber(a: Fraction): number {
  return a.num / a.den
}
