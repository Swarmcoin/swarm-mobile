import ZecPriceType from '@app/AppState/types/ZecPriceType';

export const SWM_POOL_ID =
  '0xf1e066d77279b388b40fdca7f5cf4a6559f77bdf9e2e8937ce9c2fe2960f4599';
export const SWM_TOKEN = '0xf904C14d21bEF5b8a5345a666C77C9cc2A24043B';

const poolId = (price: ZecPriceType): string =>
  price.pool?.chain === 'base' ? price.pool.id : SWM_POOL_ID;

/** The DexScreener page of the pool the price comes from, on the fixed DexScreener host. */
export const dexscreenerUrl = (price: ZecPriceType): string =>
  `https://dexscreener.com/base/${poolId(price)}`;

/** The GeckoTerminal page of the pool the price comes from, on the fixed GeckoTerminal host. */
export const geckoterminalUrl = (price: ZecPriceType): string =>
  `https://www.geckoterminal.com/base/pools/${poolId(price)}`;

/** The pool id the page shows and copies. */
export const shownPoolId = poolId;

/** A hex id cut to its first six and last four characters, `0xf1e0…4599`. */
export const shortHex = (hex: string): string =>
  `${hex.slice(0, 6)}…${hex.slice(-4)}`;
