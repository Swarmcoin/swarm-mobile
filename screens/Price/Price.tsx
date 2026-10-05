import React, { useContext, useState } from 'react';
import {
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Clipboard from '@react-native-clipboard/clipboard';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { faCopy } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-native-fontawesome';
import { ContextAppLoaded } from '@app/context';
import { RouteEnum, ScreenEnum, SnackbarDurationEnum } from '@app/AppState';
import ZecPriceType from '@app/AppState/types/ZecPriceType';
import { AppDrawerParamList } from '@app/types';
import { useTheme } from '@app/theme';
import { BG_SURFACE_NESTED } from '@app/theme/tokens';
import { fontFamily, MASKED_AMOUNT, typeScale } from '@app/theme/typography';
import { priceAvailableOnChain } from '@app/utils/priceAvailability';
import type { SwmPriceSource } from '@app/walletBackend';
import Header from '@ui/widgets/Header';
import PriceChart, { ChartPoint } from '@ui/widgets/PriceChart';
import { usePriceFreshness } from '@ui/widgets/priceFetcherStore';
import {
  formatChangePct,
  formatClock,
  formatCoin,
  formatEth,
  formatPct,
  formatSwmPrice,
  formatUsd,
} from '@ui/widgets/swmPriceFormat';
import {
  CHAIN_NAMES,
  changeTone,
  freshnessColor,
  priceAgeText,
  SOURCE_NAMES,
  useTick,
} from '@ui/widgets/swmPriceMeta';
import {
  dexscreenerUrl,
  geckoterminalUrl,
  shortHex,
  shownPoolId,
  SWM_TOKEN,
} from '@ui/widgets/swmPriceLinks';
import SettingSwitchOn from '../../assets/img/setting-switch-on.svg';
import SwitchOff from '../../assets/img/switch-off.svg';

type PriceProps = NativeStackScreenProps<
  AppDrawerParamList,
  RouteEnum.Price
> & {
  setShowSwmPriceOption: (value: boolean) => Promise<void>;
};

export type ChartRange = '24h' | '48h' | '30d';

const HOUR = 3600;
const DAY = 86400;
const CHART_HEIGHT = 190;
const RANGES: readonly ChartRange[] = ['24h', '48h', '30d'];
const SOURCES: readonly SwmPriceSource[] = ['geckoterminal', 'dexscreener'];

const timed = (
  values: number[] | undefined,
  from: number | undefined,
  lastUnix: number,
  step: number,
): ChartPoint[] => {
  if (!values || values.length < 2) {
    return [];
  }
  const start = from ?? lastUnix - (values.length - 1) * step;
  return values.map((usd, i) => ({ usd, unix: start + i * step }));
};

/** The points each chart range draws, empty when the relay sent too few. */
export const chartSeries = (
  price: ZecPriceType,
): Record<ChartRange, ChartPoint[]> => {
  const generated = price.generatedUnix ?? Math.floor(price.date / 1000);
  const hourly = timed(
    price.sparklineUsd,
    price.details?.hourlyFromUnix,
    generated - (generated % HOUR),
    HOUR,
  );
  return {
    '24h': hourly.length > 24 ? hourly.slice(-24) : hourly,
    '48h': hourly,
    '30d': timed(
      price.details?.dailyUsd,
      price.details?.dailyFromUnix,
      generated - (generated % DAY),
      DAY,
    ),
  };
};

const clockOf = (unix: number) => formatClock(unix * 1000);
const dayOf = (unix: number) =>
  new Date(unix * 1000).toLocaleDateString([], {
    day: '2-digit',
    month: 'short',
  });

export default function Price({
  navigation,
  setShowSwmPriceOption,
}: PriceProps) {
  const {
    translate,
    zecPrice,
    info,
    showSwmPrice,
    totalBalance,
    privacy,
    addLastSnackbar,
  } = useContext(ContextAppLoaded);
  const { colors } = useTheme();
  const freshness = usePriceFreshness(zecPrice);
  const series = chartSeries(zecPrice);
  const [chosen, setChosen] = useState<ChartRange>('24h');
  const onMainnet = priceAvailableOnChain(info.chainName);
  const live = onMainnet && showSwmPrice && freshness !== 'absent';
  useTick(5_000, live);

  const t = (key: string) => translate(key) as string;
  const range = series[chosen].length
    ? chosen
    : (RANGES.find(r => series[r].length) ?? chosen);

  const open = async (url: string) => {
    try {
      await Linking.openURL(url);
    } catch {
      addLastSnackbar(t('price.open-failed'));
    }
  };
  const copy = (text: string) => {
    Clipboard.setString(text);
    addLastSnackbar(t('price.page.copied'), SnackbarDurationEnum.short);
  };

  const mono = { fontFamily: fontFamily.monoRegular, color: colors.fgDefault };
  const muted = { fontFamily: fontFamily.monoRegular, color: colors.fgMuted };
  const kicker = {
    fontFamily: fontFamily.monoMedium,
    fontSize: typeScale.kicker.fontSize,
    letterSpacing: typeScale.kicker.letterSpacing,
    color: colors.fgMuted,
  };
  const card = [
    styles.card,
    {
      backgroundColor: colors.bgSurface,
      borderColor: colors.bottomSheetBorder,
    },
  ];

  const settingRow = (
    <View style={styles.settingRow}>
      <Text
        style={[styles.settingTitle, { color: colors.fgDefault }]}
        accessibilityRole="text"
      >
        {t('settings.swmprice-title')}
      </Text>
      <Pressable
        testID="price.page.switch"
        accessibilityRole="switch"
        accessibilityState={{ checked: showSwmPrice }}
        onPress={() => setShowSwmPriceOption(!showSwmPrice)}
      >
        {showSwmPrice ? (
          <SettingSwitchOn width={40} height={19} />
        ) : (
          <SwitchOff width={40} height={19} />
        )}
      </Pressable>
    </View>
  );

  const note = (
    <Text
      testID="price.page.note"
      style={[styles.note, { color: colors.fgMuted }]}
    >
      {t('price.note')}
    </Text>
  );

  const details = zecPrice.details;
  const total = totalBalance
    ? totalBalance.totalIronwoodBalance +
      totalBalance.totalOrchardBalance +
      totalBalance.totalSaplingBalance +
      totalBalance.totalTransparentBalance
    : 0;
  const unavailable = freshness === 'unavailable';
  const greyed = freshness === 'stale' || unavailable;
  const dash = '—';
  const usdOr = (n: number | undefined) =>
    n === undefined ? dash : `$${formatUsd(n)}`;
  const stats: [string, string][] = [
    [t('price.page.liquidity'), usdOr(details?.liquidityUsd)],
    [t('price.page.volume'), usdOr(details?.volume24hUsd)],
    [t('price.page.fdv'), usdOr(details?.fdvUsd)],
    [
      t('price.page.trades'),
      details?.transactions24h
        ? `${details.transactions24h.buys} / ${details.transactions24h.sells}`
        : dash,
    ],
    [
      t('price.page.fee'),
      zecPrice.pool?.feePct === undefined
        ? dash
        : formatPct(zecPrice.pool.feePct),
    ],
    [t('price.page.network'), CHAIN_NAMES[zecPrice.pool?.chain ?? 'base']],
  ];
  const ids: [string, string, string][] = [
    ['pool', t('price.page.pool'), shownPoolId(zecPrice)],
    ['token', t('price.page.token'), SWM_TOKEN],
  ];
  const changes: [string, number | undefined][] = [
    [t('price.page.period-1h'), details?.changePct1h],
    [t('price.page.period-6h'), details?.changePct6h],
    [t('price.page.period-24h'), zecPrice.changePct24h],
  ];

  return (
    <View style={[styles.screen, { backgroundColor: colors.bgCanvas }]}>
      <Header
        title={t('price.page.title')}
        screenName={ScreenEnum.Price}
        noBalance
        noSyncingStatus
        noDrawMenu
        noPrivacy
        closeScreen={() => navigation.goBack()}
      />
      {onMainnet && (
        <ScrollView testID="price.page" contentContainerStyle={styles.content}>
          {live && (
            <View style={styles.status}>
              <View
                testID={`price.page.freshness.${freshness}`}
                style={[
                  styles.dot,
                  { backgroundColor: freshnessColor(colors, freshness) },
                ]}
              />
              <Text testID="price.page.age" style={[muted, styles.small]}>
                {priceAgeText(translate, zecPrice, freshness)}
              </Text>
            </View>
          )}

          {live && (
            <View style={styles.block}>
              {unavailable ? (
                <Text style={[styles.unavailable, { color: colors.fgMuted }]}>
                  {t('price.unavailable')}
                </Text>
              ) : (
                <>
                  <Text
                    testID="price.page.value"
                    style={[
                      styles.price,
                      { color: greyed ? colors.fgMuted : colors.fgDefault },
                    ]}
                  >
                    {`$${formatSwmPrice(zecPrice.zecPrice)}`}
                    <Text style={[muted, styles.unit]}>{' USD'}</Text>
                  </Text>
                  {details?.priceEth !== undefined && (
                    <Text testID="price.page.eth" style={[muted, styles.eth]}>
                      {`${formatEth(details.priceEth)} ETH`}
                    </Text>
                  )}
                  <View style={styles.chips}>
                    {changes.map(([period, pct]) => {
                      const tone = changeTone(colors, pct);
                      return (
                        <View
                          key={period}
                          testID={`price.page.change.${period}`}
                          style={[
                            styles.chip,
                            { backgroundColor: BG_SURFACE_NESTED },
                          ]}
                        >
                          <Text
                            style={[styles.chipText, { color: tone.color }]}
                          >
                            {pct === undefined
                              ? dash
                              : `${tone.arrow}${formatChangePct(pct)} %`}
                          </Text>
                          <Text style={[muted, styles.chipPeriod]}>
                            {period}
                          </Text>
                        </View>
                      );
                    })}
                  </View>
                </>
              )}
            </View>
          )}

          {live && !unavailable && (
            <View style={card}>
              <View style={styles.ranges}>
                {RANGES.map(r => {
                  const empty = series[r].length === 0;
                  const on = r === range;
                  return (
                    <Pressable
                      key={r}
                      testID={`price.page.range.${r}`}
                      accessibilityRole="button"
                      accessibilityState={{ selected: on, disabled: empty }}
                      disabled={empty}
                      onPress={() => setChosen(r)}
                      style={[
                        styles.range,
                        {
                          borderColor: on
                            ? colors.fgAccent
                            : colors.borderMuted,
                        },
                        empty && styles.rangeEmpty,
                      ]}
                    >
                      <Text
                        style={[
                          styles.rangeText,
                          { color: on ? colors.fgAccent : colors.fgMuted },
                        ]}
                      >
                        {t(`price.page.range-${r}`)}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
              {series[range].length ? (
                <PriceChart
                  testID={`price.page.chart.${range}`}
                  points={series[range]}
                  height={CHART_HEIGHT}
                  color={greyed ? colors.fgMuted : colors.fgAccent}
                  formatTime={range === '30d' ? dayOf : clockOf}
                  accessibilityLabel={t('price.page.chart-acc')}
                />
              ) : (
                <Text
                  testID="price.page.no-chart"
                  style={[muted, styles.small]}
                >
                  {t('price.page.no-chart')}
                </Text>
              )}
            </View>
          )}

          {live && (
            <View style={card}>
              <Text style={kicker}>{t('price.page.balance')}</Text>
              <Text testID="price.page.balance" style={[mono, styles.balance]}>
                {privacy
                  ? `${MASKED_AMOUNT} ${info.currencyName} ≈ $${MASKED_AMOUNT} USD`
                  : `${formatCoin(total)} ${info.currencyName} ≈ $${formatUsd(
                      total * zecPrice.zecPrice,
                    )} USD`}
              </Text>
            </View>
          )}

          {live && (
            <View style={[card, styles.grid]}>
              {stats.map(([label, value]) => (
                <View key={label} style={styles.stat}>
                  <Text style={kicker}>{label.toUpperCase()}</Text>
                  <Text style={[mono, styles.statValue]}>{value}</Text>
                </View>
              ))}
            </View>
          )}

          {live && (
            <View style={card}>
              <Text style={kicker}>{t('price.page.sources')}</Text>
              {SOURCES.map(id => {
                const reading = details?.sources.find(src => src.id === id);
                const ok = !!reading?.ok;
                return (
                  <Pressable
                    key={id}
                    testID={`price.page.source.${id}`}
                    accessibilityRole="link"
                    accessibilityLabel={t(
                      id === 'dexscreener'
                        ? 'price.open-acc'
                        : 'price.page.open-gecko-acc',
                    )}
                    onPress={() =>
                      open(
                        id === 'dexscreener'
                          ? dexscreenerUrl(zecPrice)
                          : geckoterminalUrl(zecPrice),
                      )
                    }
                    style={styles.row}
                  >
                    <Text
                      style={[
                        styles.rowLabel,
                        { color: ok ? colors.fgDefault : colors.fgMuted },
                      ]}
                    >
                      {SOURCE_NAMES[id]}
                    </Text>
                    <Text style={ok ? mono : muted}>
                      {ok && reading?.priceUsd !== undefined
                        ? `$${formatSwmPrice(reading.priceUsd)}  ✓`
                        : dash}
                    </Text>
                  </Pressable>
                );
              })}
              {ids.map(([id, label, hex]) => (
                <View key={id} style={styles.row}>
                  <Text style={[styles.rowLabel, { color: colors.fgDefault }]}>
                    {label}
                  </Text>
                  <Pressable
                    testID={`price.page.copy.${id}`}
                    accessibilityRole="button"
                    accessibilityLabel={`${t('price.page.copy-acc')} ${label}`}
                    onPress={() => copy(hex)}
                    style={styles.copy}
                  >
                    <Text style={mono}>{shortHex(hex)}</Text>
                    <FontAwesomeIcon
                      icon={faCopy}
                      size={14}
                      color={colors.fgMuted}
                    />
                  </Pressable>
                </View>
              ))}
            </View>
          )}

          {note}
          {settingRow}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { paddingHorizontal: 16, paddingBottom: 32, gap: 14 },
  status: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dot: { width: 6, height: 6, borderRadius: 3 },
  small: { fontSize: 11 },
  block: { gap: 6 },
  price: {
    fontFamily: fontFamily.displaySemiBold,
    fontSize: 44,
    letterSpacing: -0.02 * 44,
  },
  unit: { fontSize: typeScale.mono.fontSize },
  eth: { fontSize: typeScale.mono.fontSize },
  unavailable: { fontFamily: fontFamily.displaySemiBold, fontSize: 24 },
  chips: { flexDirection: 'row', gap: 8, marginTop: 4 },
  chip: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  chipText: { fontFamily: fontFamily.monoMedium, fontSize: 12 },
  chipPeriod: { fontSize: 11 },
  card: { borderRadius: 12, borderWidth: 1, padding: 14, gap: 10 },
  ranges: { flexDirection: 'row', gap: 8 },
  range: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  rangeEmpty: { opacity: 0.4 },
  rangeText: { fontFamily: fontFamily.monoMedium, fontSize: 12 },
  balance: { fontSize: typeScale.mono.fontSize },
  grid: { flexDirection: 'row', flexWrap: 'wrap', rowGap: 14 },
  stat: { width: '50%', gap: 4 },
  statValue: { fontSize: typeScale.mono.fontSize },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 36,
  },
  rowLabel: { fontFamily: fontFamily.bodyMedium, fontSize: 14 },
  copy: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  note: { fontFamily: fontFamily.bodyRegular, fontSize: 12, lineHeight: 17 },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  settingTitle: { fontFamily: fontFamily.bodyMedium, fontSize: 15 },
});
