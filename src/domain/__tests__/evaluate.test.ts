import { describe, expect, it } from 'vitest';
import { evaluate, isClosed } from '../evaluate';
import { RULES_MVP1 } from '../rules';
import type { ClosedCheckin } from '../types';
import { closed } from './helpers';

const R = RULES_MVP1;
const row = (over: Partial<ClosedCheckin>) => closed('2026-11-10', over) as ClosedCheckin;

describe('sleep: lights-off 19:00..00:00 inclusive', () => {
  it.each([
    ['00:00', true],
    ['00:01', false],
    ['18:59', false],
    ['19:00', true],
    ['23:59', true],
    ['11:59', false],
    ['12:00', false],
  ])('%s -> %s', (lightsOff, expected) => {
    expect(evaluate(row({ lightsOff }), R).sleep).toBe(expected);
  });
});

describe('water: >= 1,400 ml, no ceiling', () => {
  it.each([
    [1399, false],
    [1400, true],
    [2971, true],
    [5000, true],
    [0, false],
  ])('%i ml -> %s', (waterMl, expected) => {
    expect(evaluate(row({ waterMl }), R).water).toBe(expected);
  });
});

describe('walk: >= 5,000 steps, or >= 2,000 on a Home day', () => {
  it.each([
    [4999, false, false],
    [5000, false, true],
    [1999, true, false],
    [2000, true, true],
  ])('%i steps, homeDay=%s -> %s', (steps, homeDay, expected) => {
    expect(evaluate(row({ steps, homeDay }), R).walk).toBe(expected);
  });
});

describe('passCount', () => {
  it('counts habits in range', () => {
    expect(evaluate(row({}), R)).toEqual({ walk: true, water: true, sleep: true, passCount: 3 });
    expect(evaluate(row({ waterMl: 0 }), R).passCount).toBe(2);
    expect(evaluate(row({ waterMl: 0, steps: 0 }), R).passCount).toBe(1);
    expect(evaluate(row({ waterMl: 0, steps: 0, lightsOff: '02:00' }), R).passCount).toBe(0);
  });
});

describe('isClosed', () => {
  it('is false for a water-only row', () => {
    expect(isClosed(closed('2026-11-10', { steps: null, lightsOff: null, completedAt: null }))).toBe(false);
  });
  it('is false while completedAt is null even if values are present (today)', () => {
    expect(isClosed(closed('2026-11-10', { completedAt: null }))).toBe(false);
  });
  it('is true for a closed row', () => {
    expect(isClosed(closed('2026-11-10'))).toBe(true);
  });
});
