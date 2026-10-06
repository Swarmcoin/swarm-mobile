import {
  fetchSwmPrice,
  parseSwmPrice,
  SWM_PRICE_MAX_CHARS,
  SWM_PRICE_TIMEOUT_MS,
  SWM_PRICE_URL,
} from '@app/walletBackend/modules/SwmPriceService';
import swmRelayFixture from '../__mocks__/dataMocks/swmPriceRelay.json';
import swmRelayLive from '../__mocks__/dataMocks/swmPriceRelayLive.json';

const swmRelayBody = JSON.stringify(swmRelayFixture);

type Answer = { status: number; body: string; length?: string };

const answer = ({ status, body, length }: Answer) => ({
  status,
  headers: {
    get: (name: string) => (name === 'content-length' ? length : undefined),
  },
  text: async () => body,
});

const withBody = (patch: object): string =>
  JSON.stringify({ ...swmRelayFixture, ...patch });

let fetchMock: jest.Mock;

beforeEach(() => {
  fetchMock = jest.fn();
  global.fetch = fetchMock;
});

afterEach(() => {
  jest.useRealTimers();
});

describe('parseSwmPrice', () => {
  test('Tests that a relay body becomes a reading when it follows swarm-price/1. The fixture is the specification example.', () => {
    expect(parseSwmPrice(swmRelayBody)).toEqual({
      kind: 'swmPrice',
      reading: {
        priceUsd: 0.84114343,
        changePct24h: 36.72,
        sparklineUsd: [0.5259, 0.573, 0.6361, 0.6533, 0.7537, 0.8411],
        source: 'geckoterminal',
        generatedUnix: 1791223633,
        stale: false,
        pool: {
          chain: 'base',
          dex: 'uniswap-v4',
          id: '0xf1e066d77279b388b40fdca7f5cf4a6559f77bdf9e2e8937ce9c2fe2960f4599',
          feePct: 0.9,
          createdUnix: 1790812800,
        },
        details: {
          priceEth: 0.000195976,
          changePct1h: 0,
          changePct6h: 28.75,
          hourlyFromUnix: 1791205200,
          hourlyEndsLive: false,
          dailyUsd: [0.3112, 0.3305, 0.4021, 0.5259, 0.6151, 0.8411],
          dailyFromUnix: 1790812800,
          dailyEndsLive: false,
          transactions24h: { buys: 9, sells: 0 },
          liquidityUsd: 3761.34,
          volume24hUsd: 378.11,
          fdvUsd: 8411.43,
          sources: [
            { id: 'geckoterminal', ok: true, priceUsd: 0.84114343 },
            { id: 'dexscreener', ok: true, priceUsd: 0.8602 },
          ],
        },
      },
    });
  });

  test('Tests that the live relay body of 2026-10-05 19:01 UTC parses into a reading. It predates the daily series.', () => {
    const outcome = parseSwmPrice(JSON.stringify(swmRelayLive));
    expect(outcome.kind).toBe('swmPrice');
    if (outcome.kind !== 'swmPrice') {
      return;
    }
    expect(outcome.reading.priceUsd).toBe(0.84114343498587);
    expect(outcome.reading.sparklineUsd).toHaveLength(48);
    expect(outcome.reading.details.priceEth).toBe(0.000195976178807639);
    expect(outcome.reading.details.changePct6h).toBe(24.56);
    expect(outcome.reading.details.dailyUsd).toBeUndefined();
    expect(outcome.reading.details.sources.map(src => src.ok)).toEqual([
      true,
      true,
    ]);
  });

  test('Tests that the on-chain pool reading parses as source pool, first among the sources.', () => {
    const outcome = parseSwmPrice(
      withBody({
        source: 'pool',
        sources: [
          { id: 'pool', ok: true, price_usd: '1.42', fetched_unix: 1791223633 },
          {
            id: 'dexscreener',
            ok: true,
            price_usd: '1.42',
            fetched_unix: 1791223633,
          },
          {
            id: 'geckoterminal',
            ok: true,
            price_usd: '1.28',
            fetched_unix: 1791223633,
          },
        ],
      }),
    );
    expect(outcome.kind).toBe('swmPrice');
    if (outcome.kind !== 'swmPrice') {
      return;
    }
    expect(outcome.reading.source).toBe('pool');
    expect(outcome.reading.details.sources).toEqual([
      { id: 'pool', ok: true, priceUsd: 1.42 },
      { id: 'dexscreener', ok: true, priceUsd: 1.42 },
      { id: 'geckoterminal', ok: true, priceUsd: 1.28 },
    ]);
  });

  test.each([
    ['another schema', withBody({ schema: 'swarm-price/2' })],
    ['another symbol', withBody({ symbol: 'ZEC' })],
    ['another quote', withBody({ quote: 'EUR' })],
    ['a float price', withBody({ price_usd: 0.84 })],
    ['a zero price', withBody({ price_usd: '0' })],
    ['a negative price', withBody({ price_usd: '-1.5' })],
    ['an exponent price', withBody({ price_usd: '8e-1' })],
    ['a missing generation time', withBody({ generated_unix: undefined })],
    ['an array', '[]'],
    ['a truncated body', swmRelayBody.slice(0, 40)],
  ])(
    'Tests that the parser answers price.error-response when the body has %s.',
    (_case, body) => {
      expect(parseSwmPrice(body)).toEqual({
        kind: 'error',
        errorKey: 'price.error-response',
      });
    },
  );

  test('Tests that the relay error body reads as price.error-unavailable when the relay has no price.', () => {
    expect(
      parseSwmPrice('{"schema":"swarm-price/1","error":"unavailable"}'),
    ).toEqual({ kind: 'error', errorKey: 'price.error-unavailable' });
  });

  test('Tests that a malformed sparkline, source or pool drops only that part when the price itself is valid.', () => {
    const outcome = parseSwmPrice(
      withBody({
        sparkline_usd: [0.5, 'x'],
        source: 'somewhere',
        pool: { chain: 'base', dex: 'uniswap-v4', id: 'https://evil.example' },
        change_pct: { h24: 'up' },
        stale: 'yes',
      }),
    );
    expect(outcome).toEqual({
      kind: 'swmPrice',
      reading: {
        priceUsd: 0.84114343,
        changePct24h: undefined,
        sparklineUsd: undefined,
        source: undefined,
        generatedUnix: 1791223633,
        stale: false,
        pool: undefined,
        details: expect.objectContaining({ changePct1h: undefined }),
      },
    });
  });

  test('Tests that the page fields read as absent when the relay leaves them out. The price still parses.', () => {
    const outcome = parseSwmPrice(
      JSON.stringify({
        schema: 'swarm-price/1',
        symbol: 'SWM',
        quote: 'USD',
        price_usd: '0.84',
        generated_unix: 1791223633,
      }),
    );
    expect(outcome.kind === 'swmPrice' && outcome.reading.details).toEqual({
      priceEth: undefined,
      changePct1h: undefined,
      changePct6h: undefined,
      hourlyFromUnix: undefined,
      hourlyEndsLive: false,
      dailyUsd: undefined,
      dailyFromUnix: undefined,
      dailyEndsLive: false,
      transactions24h: undefined,
      liquidityUsd: undefined,
      volume24hUsd: undefined,
      fdvUsd: undefined,
      sources: [],
    });
  });

  test('Tests that each page field with a wrong type drops alone when the relay sends it.', () => {
    const outcome = parseSwmPrice(
      withBody({
        price_eth: 0.0002,
        change_pct: { h1: '1', h6: null, h24: 36.72 },
        hourly_from_unix: -5,
        daily_usd: [0.3, -1],
        daily_from_unix: 'yesterday',
        transactions_24h: null,
        liquidity_usd: -3,
        volume_24h_usd: 'lots',
        fdv_usd: Infinity,
        pool: {
          chain: 'base',
          dex: 'uniswap-v4',
          id: '0xf1e066d77279b388b40fdca7f5cf4a6559f77bdf9e2e8937ce9c2fe2960f4599',
          fee_pct: '0.9',
          created_unix: 0,
        },
        sources: [
          { id: 'geckoterminal', ok: true, price_usd: 0.84 },
          { id: 'dexscreener', ok: false, price_usd: '0.86' },
          { id: 'coingecko', ok: true, price_usd: '0.9' },
          'junk',
        ],
      }),
    );
    expect(outcome.kind).toBe('swmPrice');
    if (outcome.kind !== 'swmPrice') {
      return;
    }
    expect(outcome.reading.changePct24h).toBe(36.72);
    expect(outcome.reading.pool?.feePct).toBeUndefined();
    expect(outcome.reading.pool?.createdUnix).toBeUndefined();
    expect(outcome.reading.details).toEqual({
      priceEth: undefined,
      changePct1h: undefined,
      changePct6h: undefined,
      hourlyFromUnix: undefined,
      hourlyEndsLive: false,
      dailyUsd: undefined,
      dailyFromUnix: undefined,
      dailyEndsLive: false,
      transactions24h: undefined,
      liquidityUsd: undefined,
      volume24hUsd: undefined,
      fdvUsd: undefined,
      sources: [
        { id: 'geckoterminal', ok: true, priceUsd: undefined },
        { id: 'dexscreener', ok: false, priceUsd: undefined },
      ],
    });
  });

  test('Tests that the daily series keeps the newest 30 closes plus the live price when the relay sends more, and moves its first day on.', () => {
    const points = Array.from({ length: 40 }, (_, i) => i + 1);
    const outcome = parseSwmPrice(
      withBody({ daily_usd: points, daily_from_unix: 1_000_000 }),
    );
    expect(outcome.kind).toBe('swmPrice');
    if (outcome.kind !== 'swmPrice') {
      return;
    }
    expect(outcome.reading.details.dailyUsd).toEqual(points.slice(9));
    expect(outcome.reading.details.dailyFromUnix).toBe(1_000_000 + 9 * 86400);
    expect(outcome.reading.details.dailyEndsLive).toBe(true);
  });

  test('Tests that the sparkline keeps the newest 48 closes plus the live price when the relay sends more, and moves its first hour on.', () => {
    const points = Array.from({ length: 60 }, (_, i) => i + 1);
    const outcome = parseSwmPrice(
      withBody({ sparkline_usd: points, hourly_from_unix: 7_200 }),
    );
    expect(outcome.kind).toBe('swmPrice');
    if (outcome.kind !== 'swmPrice') {
      return;
    }
    expect(outcome.reading.sparklineUsd).toEqual(points.slice(11));
    expect(outcome.reading.details.hourlyFromUnix).toBe(7_200 + 11 * 3600);
    expect(outcome.reading.details.hourlyEndsLive).toBe(true);
  });

  test.each([
    [48, 48, false],
    [49, 48, true],
    [25, 24, true],
    [24, 24, false],
  ])(
    'Tests that %i hourly values with sparkline_hours %i read as ending at the live price: %s.',
    (count, hours, live) => {
      const points = Array.from({ length: count }, (_, i) => i + 1);
      const outcome = parseSwmPrice(
        withBody({ sparkline_usd: points, sparkline_hours: hours }),
      );
      expect(
        outcome.kind === 'swmPrice' && outcome.reading.details.hourlyEndsLive,
      ).toBe(live);
    },
  );

  test('Tests that a daily series of 31 values reads as 30 closes and the live price.', () => {
    const points = Array.from({ length: 31 }, (_, i) => i + 1);
    const outcome = parseSwmPrice(withBody({ daily_usd: points }));
    expect(
      outcome.kind === 'swmPrice' && outcome.reading.details.dailyEndsLive,
    ).toBe(true);
  });

  test('Tests that the relay stale flag reaches the reading when the relay serves its last good value.', () => {
    const outcome = parseSwmPrice(withBody({ stale: true }));
    expect(outcome.kind === 'swmPrice' && outcome.reading.stale).toBe(true);
  });
});

describe('fetchSwmPrice', () => {
  test('Tests that the request goes to the fixed relay URL with no wallet data when the store asks for a price.', async () => {
    fetchMock.mockResolvedValue(answer({ status: 200, body: swmRelayBody }));
    const outcome = await fetchSwmPrice();
    expect(outcome.kind).toBe('swmPrice');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(SWM_PRICE_URL);
    expect(url).toBe('https://wallet.swarm.green/api/price/swm');
    expect(init.method).toBe('GET');
    expect(init.headers).toEqual({ Accept: 'application/json' });
    expect(init.credentials).toBe('omit');
    expect(init.body).toBeUndefined();
  });

  test('Tests that the request ends with price.error-timeout when the relay does not answer in 8 s.', async () => {
    jest.useFakeTimers();
    fetchMock.mockImplementation(
      (_url: string, init: { signal: AbortSignal }) =>
        new Promise((_resolve, reject) => {
          init.signal.addEventListener('abort', () =>
            reject(new Error('aborted')),
          );
        }),
    );
    const pending = fetchSwmPrice();
    await jest.advanceTimersByTimeAsync(SWM_PRICE_TIMEOUT_MS - 1);
    let settled = false;
    pending.then(() => {
      settled = true;
    });
    await jest.advanceTimersByTimeAsync(0);
    expect(settled).toBe(false);
    await jest.advanceTimersByTimeAsync(1);
    await expect(pending).resolves.toEqual({
      kind: 'error',
      errorKey: 'price.error-timeout',
    });
  });

  test('Tests that a refused connection reads as price.error-network when fetch rejects.', async () => {
    fetchMock.mockRejectedValue(new TypeError('Network request failed'));
    await expect(fetchSwmPrice()).resolves.toEqual({
      kind: 'error',
      errorKey: 'price.error-network',
    });
  });

  test('Tests that a 503 with the relay error body reads as price.error-unavailable.', async () => {
    fetchMock.mockResolvedValue(
      answer({
        status: 503,
        body: '{"schema":"swarm-price/1","error":"unavailable"}',
      }),
    );
    await expect(fetchSwmPrice()).resolves.toEqual({
      kind: 'error',
      errorKey: 'price.error-unavailable',
    });
  });

  test.each([
    ['a 404', answer({ status: 404, body: swmRelayBody })],
    ['a 503 that carries a price', answer({ status: 503, body: swmRelayBody })],
    [
      'a declared length over 64 KiB',
      answer({
        status: 200,
        body: swmRelayBody,
        length: String(SWM_PRICE_MAX_CHARS + 1),
      }),
    ],
    [
      'a body over 64 KiB',
      answer({
        status: 200,
        body: swmRelayBody + ' '.repeat(SWM_PRICE_MAX_CHARS),
      }),
    ],
  ])(
    'Tests that the request answers price.error-response when the relay sends %s.',
    async (_case, response) => {
      fetchMock.mockResolvedValue(response);
      await expect(fetchSwmPrice()).resolves.toEqual({
        kind: 'error',
        errorKey: 'price.error-response',
      });
    },
  );
});
