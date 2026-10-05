import { getNumberFormatSettings } from 'react-native-localize';

const group = (digits: string, separator: string): string =>
  digits.replace(/\B(?=(\d{3})+(?!\d))/g, separator);

const localize = (fixed: string): string => {
  const { decimalSeparator, groupingSeparator } = getNumberFormatSettings();
  const [whole, fraction] = fixed.split('.');
  const grouped = group(whole, groupingSeparator);
  return fraction === undefined
    ? grouped
    : `${grouped}${decimalSeparator}${fraction}`;
};

/** Rounds half-up to `places` decimals, clear of binary representation error. */
export const roundHalfUp = (n: number, places: number): number => {
  const scale = 10 ** places;
  return Math.round(n * scale + Math.sign(n) * 1e-7) / scale;
};

/** A USD amount with two decimals and the locale's separators, `< 0.01` for dust. */
export const formatUsd = (usd: number): string => {
  const rounded = roundHalfUp(usd, 2);
  if (usd > 0 && rounded === 0) {
    return `< ${localize('0.01')}`;
  }
  return localize(rounded.toFixed(2));
};

/** The price of one SWM, two decimals at 1 USD and above, four significant digits below. */
export const formatSwmPrice = (usd: number): string => {
  if (usd >= 1) {
    return localize(roundHalfUp(usd, 2).toFixed(2));
  }
  const places = Math.min(3 - Math.floor(Math.log10(usd)), 12);
  return localize(roundHalfUp(usd, places).toFixed(places));
};

/** The size of a percentage change with one decimal, sign carried by the arrow. */
export const formatChangePct = (pct: number): string =>
  localize(roundHalfUp(Math.abs(pct), 1).toFixed(1));

/** The local wall-clock time of `date` as hh:mm. */
export const formatClock = (date: number): string =>
  new Date(date).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });

/** A price in ETH with three significant digits, `0.000196`. */
export const formatEth = (eth: number): string => {
  const places = Math.min(2 - Math.floor(Math.log10(eth)), 18);
  return localize(
    roundHalfUp(eth, Math.max(places, 0)).toFixed(Math.max(places, 0)),
  );
};

/** A coin amount with grouping and two to eight decimals, trailing zeros dropped. */
export const formatCoin = (amount: number): string => {
  const fixed = amount.toFixed(8).replace(/0{1,6}$/, '');
  return localize(fixed);
};

/** A plain percentage, `0.9 %`. */
export const formatPct = (pct: number): string =>
  `${localize(roundHalfUp(pct, 2).toString())} %`;
