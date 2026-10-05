import { useEffect, useReducer } from 'react';
import { TranslateType } from '@app/AppState';
import ZecPriceType from '@app/AppState/types/ZecPriceType';
import { ThemeColors } from '@app/theme';
import { PRICE_UP } from '@app/theme/tokens';
import { PriceFreshness } from './priceFetcherStore';
import { formatClock } from './swmPriceFormat';

export const SOURCE_NAMES: Record<string, string> = {
  geckoterminal: 'GeckoTerminal',
  dexscreener: 'DexScreener',
};

/** `updated 12 s ago` while the reading is fresh, `as of 14:05` after that. */
export const priceAgeText = (
  translate: (key: string) => TranslateType,
  price: ZecPriceType,
  freshness: PriceFreshness,
): string => {
  if (freshness !== 'fresh') {
    return (translate('header.lastupdate') as string).replace(
      '{time}',
      formatClock(price.date),
    );
  }
  const seconds = Math.max(0, Math.round((Date.now() - price.date) / 1000));
  return seconds < 60
    ? (translate('price.updated-seconds') as string).replace(
        '{n}',
        String(seconds),
      )
    : (translate('price.updated-minutes') as string).replace(
        '{n}',
        String(Math.floor(seconds / 60)),
      );
};

/** The freshness dot: accent when fresh, amber when ageing, grey after. */
export const freshnessColor = (
  colors: ThemeColors,
  freshness: PriceFreshness,
): string =>
  freshness === 'fresh'
    ? colors.fgAccent
    : freshness === 'ageing'
      ? colors.fgWarning
      : colors.bgMuted;

/** The arrow and colour of a percentage change, neutral at zero or when unknown. */
export const changeTone = (
  colors: ThemeColors,
  pct: number | undefined,
): { arrow: string; color: string } =>
  pct === undefined || pct === 0
    ? { arrow: '', color: colors.fgMuted }
    : pct > 0
      ? { arrow: '▲ ', color: PRICE_UP }
      : { arrow: '▼ ', color: colors.fgDanger };

/** Re-renders every `periodMs` while `active`, for relative times. */
export function useTick(periodMs: number, active: boolean): void {
  const [, tick] = useReducer((n: number) => n + 1, 0);
  useEffect(() => {
    if (!active) {
      return;
    }
    const timer = setInterval(tick, periodMs);
    return () => clearInterval(timer);
  }, [periodMs, active]);
}
