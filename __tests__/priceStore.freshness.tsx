jest.mock('@app/walletBackend', () => ({
  __esModule: true,
  fetchSwmPrice: jest.fn(),
}));

import 'react-native';
import React from 'react';
import { render } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { PriceTrafficDriver } from '@ui/widgets/PriceFetcher';
import {
  priceFetcherStore,
  priceFreshness,
} from '@ui/widgets/priceFetcherStore';
import {
  ContextAppLoadedProvider,
  defaultAppContextLoaded,
} from '@app/context';
import { SelectServerEnum } from '@app/AppState';
import type { ZecPriceType } from '@app/AppState';
import { fetchSwmPrice } from '@app/walletBackend';
import { loadSwmPrice, saveSwmPrice } from '@app/services/swmPriceCache';
import {
  mockMainnetInfo,
  mockSwmPrice,
  swmFailed,
  swmOk,
} from '../__mocks__/dataMocks/mockSwmPrice';

const price = fetchSwmPrice as jest.MockedFunction<typeof fetchSwmPrice>;
const getItem = AsyncStorage.getItem as jest.MockedFunction<
  typeof AsyncStorage.getItem
>;
const setItem = AsyncStorage.setItem as jest.MockedFunction<
  typeof AsyncStorage.setItem
>;

const NOW = 1_800_000_000_000;
const MIN = 60_000;

type Ctx = typeof defaultAppContextLoaded;
const driverUi = (setZecPrice: (p: ZecPriceType) => void) => {
  const ctx: Ctx = {
    ...defaultAppContextLoaded,
    translate: (k: string) => k,
    info: mockMainnetInfo,
    selectServer: SelectServerEnum.auto,
    showSwmPrice: true,
    setZecPrice,
  };
  return (
    <ContextAppLoadedProvider value={ctx}>
      <PriceTrafficDriver />
    </ContextAppLoadedProvider>
  );
};

beforeAll(() => {
  const RN: typeof import('react-native') = require('react-native');
  jest
    .spyOn(RN.AppState, 'addEventListener')
    .mockImplementation(() => ({ remove: jest.fn() }));
});

beforeEach(() => {
  price.mockReset();
  getItem.mockReset();
  setItem.mockReset();
  priceFetcherStore.resetForTests();
});

afterEach(() => {
  jest.useRealTimers();
});

describe('priceFreshness', () => {
  test.each([
    [0, 'fresh'],
    [4 * MIN, 'fresh'],
    [6 * MIN, 'ageing'],
    [29 * MIN, 'ageing'],
    [31 * MIN, 'stale'],
    [59 * MIN, 'stale'],
    [61 * MIN, 'unavailable'],
  ])(
    'Tests that a reading %i ms old reads %s when the relay marks it current.',
    (age, state) => {
      expect(priceFreshness(mockSwmPrice(NOW - age), NOW)).toBe(state);
    },
  );

  test('Tests that a relay-stale reading reads stale when it is younger than 30 minutes.', () => {
    const reading = { ...mockSwmPrice(NOW - MIN), relayStale: true };
    expect(priceFreshness(reading, NOW)).toBe('stale');
  });

  test('Tests that a restored reading reads ageing when it is younger than 5 minutes. It shows greyed until the first fresh read.', () => {
    const reading = { ...mockSwmPrice(NOW - MIN), restored: true };
    expect(priceFreshness(reading, NOW)).toBe('ageing');
  });

  test('Tests that no reading reads absent when the date or the price is zero.', () => {
    expect(priceFreshness({ zecPrice: 0, date: 0 }, NOW)).toBe('absent');
    expect(priceFreshness({ zecPrice: 0, date: NOW }, NOW)).toBe('absent');
  });
});

describe('the kept reading', () => {
  test('Tests that a saved reading loads back marked restored when the app starts again.', async () => {
    await saveSwmPrice(mockSwmPrice(NOW));
    const [key, raw] = setItem.mock.calls[0];
    expect(key).toBe('swm-price/last');
    getItem.mockResolvedValue(raw);
    await expect(loadSwmPrice()).resolves.toEqual({
      ...mockSwmPrice(NOW),
      restored: true,
    });
  });

  test.each([
    ['nothing kept', undefined],
    ['broken JSON', '{"zecPrice":'],
    ['a zero price', '{"zecPrice":0,"date":1}'],
    ['a text price', '{"zecPrice":"1","date":1}'],
  ])(
    'Tests that the cache answers undefined when the device holds %s.',
    async (_case, raw) => {
      getItem.mockResolvedValue(raw ?? null);
      await expect(loadSwmPrice()).resolves.toBeUndefined();
    },
  );

  test('Tests that the store saves each good reading when the relay answers.', async () => {
    jest.useFakeTimers();
    price.mockResolvedValue(swmOk(0.8411));
    const setZecPrice = jest.fn();

    render(driverUi(setZecPrice));
    await jest.advanceTimersByTimeAsync(0);

    expect(setZecPrice).toHaveBeenCalledWith(
      expect.objectContaining({ zecPrice: 0.8411, restored: false }),
    );
    expect(setItem).toHaveBeenCalledWith(
      'swm-price/last',
      expect.stringContaining('"zecPrice":0.8411'),
    );
  });

  test('Tests that the kept reading shows restored when the first fetch fails.', async () => {
    jest.useFakeTimers();
    getItem.mockResolvedValue(JSON.stringify(mockSwmPrice(NOW)));
    price.mockResolvedValue(swmFailed('price.error-unavailable'));
    const setZecPrice = jest.fn();

    render(driverUi(setZecPrice));
    await jest.advanceTimersByTimeAsync(0);

    expect(setZecPrice).toHaveBeenCalledTimes(1);
    expect(setZecPrice).toHaveBeenCalledWith(
      expect.objectContaining({ zecPrice: 0.84114343, restored: true }),
    );
    expect(priceFetcherStore.snapshot().lastErrorKey).toBe(
      'price.error-unavailable',
    );
  });

  test('Tests that the kept reading never replaces a fresh read when the cache answers late.', async () => {
    jest.useFakeTimers();
    let answerCache: (raw: string) => void = () => {};
    getItem.mockImplementation(
      () =>
        new Promise<string>(resolve => {
          answerCache = resolve;
        }),
    );
    price.mockResolvedValue(swmOk(0.9));
    const setZecPrice = jest.fn();

    render(driverUi(setZecPrice));
    await jest.advanceTimersByTimeAsync(0);
    answerCache(JSON.stringify(mockSwmPrice(NOW)));
    await jest.advanceTimersByTimeAsync(0);

    expect(setZecPrice).toHaveBeenCalledTimes(1);
    expect(setZecPrice).toHaveBeenCalledWith(
      expect.objectContaining({ zecPrice: 0.9 }),
    );
  });
});
