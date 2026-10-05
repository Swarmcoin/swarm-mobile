import {
  fetchSwmPrice,
  parseSwmPrice,
  SWM_PRICE_MAX_CHARS,
  SWM_PRICE_TIMEOUT_MS,
  SWM_PRICE_URL,
} from '@app/walletBackend/modules/SwmPriceService';
import swmRelayFixture from '../__mocks__/dataMocks/swmPriceRelay.json';

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
        },
      },
    });
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
      },
    });
  });

  test('Tests that the sparkline keeps the newest 48 points when the relay sends more.', () => {
    const points = Array.from({ length: 60 }, (_, i) => i + 1);
    const outcome = parseSwmPrice(withBody({ sparkline_usd: points }));
    expect(outcome.kind === 'swmPrice' && outcome.reading.sparklineUsd).toEqual(
      points.slice(12),
    );
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
