import {
  formatChangePct,
  formatSwmPrice,
  formatUsd,
  roundHalfUp,
} from '@ui/widgets/swmPriceFormat';
import { sparklinePath } from '@ui/primitives/Sparkline';

test.each([
  [0.84114343, '0.8411'],
  [0.084114343, '0.08411'],
  [0.00012345, '0.0001235'],
  [1, '1.00'],
  [9364.104, '9,364.10'],
  [1234567.891, '1,234,567.89'],
])('Tests that one SWM at %d USD reads %s.', (usd, shown) => {
  expect(formatSwmPrice(usd)).toBe(shown);
});

test.each([
  [9364.105, '9,364.11'],
  [187.6, '187.60'],
  [0.005, '0.01'],
  [0.004, '< 0.01'],
  [0, '0.00'],
])(
  'Tests that a balance worth %d USD reads %s, rounded half-up.',
  (usd, shown) => {
    expect(formatUsd(usd)).toBe(shown);
  },
);

test('Tests that half-up rounding holds when the binary value sits just under the half.', () => {
  expect(roundHalfUp(1.005, 2)).toBe(1.01);
  expect(roundHalfUp(2.675, 2)).toBe(2.68);
});

test.each([
  [36.72, '36.7'],
  [-3.24, '3.2'],
  [0, '0.0'],
])(
  'Tests that a change of %d %% reads %s with the sign left to the arrow.',
  (pct, shown) => {
    expect(formatChangePct(pct)).toBe(shown);
  },
);

test('Tests that the sparkline runs from the oldest point on the left to the newest on the right, low values at the bottom.', () => {
  expect(sparklinePath([1, 3, 2], 100, 40)).toBe(
    'M2.0 38.0 L50.0 2.0 L98.0 20.0',
  );
});

test('Tests that a flat sparkline draws a line at the bottom when every point is equal.', () => {
  expect(sparklinePath([5, 5], 10, 10)).toBe('M2.0 8.0 L8.0 8.0');
});
