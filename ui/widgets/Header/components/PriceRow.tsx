/* eslint-disable react-native/no-inline-styles */
import React, { useEffect, useReducer, useState } from 'react';
import { Image, Linking, Pressable, Text, View } from 'react-native';
import { faInfoCircle } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-native-fontawesome';
import { useTheme } from '@app/theme';
import { BG_SURFACE_NESTED, PRICE_UP } from '@app/theme/tokens';
import { fontFamily, typeScale } from '@app/theme/typography';
import { TranslateType } from '@app/AppState';
import ZecPriceType from '@app/AppState/types/ZecPriceType';
import { getSwarmMark } from '@app/utils/ZingoAppData';
import Sparkline from '@ui/primitives/Sparkline';
import {
  PriceFreshness,
  usePriceFetcherStore,
  usePriceFreshness,
} from '@ui/widgets/priceFetcherStore';
import {
  formatChangePct,
  formatClock,
  formatSwmPrice,
} from '@ui/widgets/swmPriceFormat';

type PriceRowProps = {
  translate: (key: string) => TranslateType;
  zecPrice: ZecPriceType;
  shown: boolean;
  addLastSnackbar?: (msg: string) => void;
  onLayout?: (height: number) => void;
};

// Vertical margins on the card. Reported back via onLayout so the parent
// can size its bottom-sheet snap points to cover the whole price block
// (margins included), not just the card itself.
const CARD_MARGIN_TOP = 10;
const CARD_MARGIN_BOTTOM = 12;
const CARD_VERTICAL_MARGINS = CARD_MARGIN_TOP + CARD_MARGIN_BOTTOM;
const META_TICK_MS = 5_000;

const SWM_POOL_ID =
  '0xf1e066d77279b388b40fdca7f5cf4a6559f77bdf9e2e8937ce9c2fe2960f4599';

const CHAIN_NAMES: Record<string, string> = { base: 'Base' };
const DEX_NAMES: Record<string, string> = { 'uniswap-v4': 'Uniswap v4' };
const SOURCE_NAMES: Record<string, string> = {
  geckoterminal: 'GeckoTerminal',
  dexscreener: 'DexScreener',
};

/** The DexScreener page of the pool the price comes from, on the fixed DexScreener host. */
export const listingUrl = (price: ZecPriceType): string =>
  `https://dexscreener.com/base/${
    price.pool?.chain === 'base' ? price.pool.id : SWM_POOL_ID
  }`;

const ageText = (
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

const PriceRow = React.memo(
  ({
    translate,
    zecPrice,
    shown,
    addLastSnackbar,
    onLayout,
  }: PriceRowProps) => {
    const { colors } = useTheme();
    const freshness = usePriceFreshness(zecPrice);
    const { lastErrorKey } = usePriceFetcherStore();
    const [noteOpen, setNoteOpen] = useState<boolean>(false);
    const [, tick] = useReducer((n: number) => n + 1, 0);

    const live = shown && freshness !== 'absent';
    useEffect(() => {
      if (!live) {
        return;
      }
      const timer = setInterval(tick, META_TICK_MS);
      return () => clearInterval(timer);
    }, [live]);

    if (!live) {
      return <></>;
    }

    const unavailable = freshness === 'unavailable';
    const greyed = freshness === 'stale' || unavailable;
    const dot =
      freshness === 'fresh'
        ? colors.fgAccent
        : freshness === 'ageing'
          ? colors.fgWarning
          : colors.bgMuted;
    const change = zecPrice.changePct24h;
    const changeColor =
      change === undefined || change === 0
        ? colors.fgMuted
        : change > 0
          ? PRICE_UP
          : colors.fgDanger;
    const arrow =
      change === undefined || change === 0 ? '' : change > 0 ? '▲ ' : '▼ ';
    const meta = [
      CHAIN_NAMES[zecPrice.pool?.chain ?? 'base'],
      DEX_NAMES[zecPrice.pool?.dex ?? 'uniswap-v4'],
      zecPrice.source ? SOURCE_NAMES[zecPrice.source] : undefined,
      unavailable && lastErrorKey
        ? (translate(lastErrorKey) as string)
        : ageText(translate, zecPrice, freshness),
    ]
      .filter(part => !!part)
      .join(' · ');

    const openListing = async () => {
      try {
        await Linking.openURL(listingUrl(zecPrice));
      } catch {
        addLastSnackbar?.(translate('price.open-failed') as string);
      }
    };

    return (
      <Pressable
        testID="price.card"
        accessibilityRole="link"
        accessibilityLabel={translate('price.open-acc') as string}
        onPress={openListing}
        onLongPress={() => setNoteOpen(!noteOpen)}
        onLayout={e =>
          onLayout?.(e.nativeEvent.layout.height + CARD_VERTICAL_MARGINS)
        }
        style={{
          alignSelf: 'stretch',
          marginHorizontal: 20,
          marginTop: CARD_MARGIN_TOP,
          marginBottom: CARD_MARGIN_BOTTOM,
          paddingHorizontal: 14,
          paddingVertical: 12,
          borderRadius: 12,
          backgroundColor: colors.bgSurface,
          borderWidth: 1,
          borderColor: colors.bottomSheetBorder,
          gap: 6,
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Image
            source={getSwarmMark()}
            style={{ width: 16, height: 16, resizeMode: 'contain' }}
          />
          <Text
            style={{
              fontFamily: fontFamily.monoMedium,
              fontSize: typeScale.kicker.fontSize,
              letterSpacing: typeScale.kicker.letterSpacing,
              color: colors.fgMuted,
            }}
          >
            {translate('price.label') as string}
          </Text>
          <View
            testID={`price.freshness.${freshness}`}
            style={{
              width: 6,
              height: 6,
              borderRadius: 3,
              backgroundColor: dot,
            }}
          />
          <View style={{ flex: 1 }} />
          <Pressable
            testID="price.info"
            accessibilityRole="button"
            accessibilityLabel={translate('price.info-acc') as string}
            hitSlop={12}
            onPress={() => setNoteOpen(!noteOpen)}
          >
            <FontAwesomeIcon
              icon={faInfoCircle}
              size={14}
              color={colors.fgMuted}
            />
          </Pressable>
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <View style={{ flex: 1, gap: 6 }}>
            {unavailable ? (
              <Text
                style={{
                  fontFamily: fontFamily.displaySemiBold,
                  fontSize: 20,
                  color: colors.fgMuted,
                }}
              >
                {translate('price.unavailable') as string}
              </Text>
            ) : (
              <Text
                testID="price.value"
                style={{
                  fontFamily: fontFamily.displaySemiBold,
                  fontSize: 30,
                  letterSpacing: -0.015 * 30,
                  color: greyed ? colors.fgMuted : colors.fgDefault,
                }}
              >
                {`$${formatSwmPrice(zecPrice.zecPrice)}`}
                <Text
                  style={{
                    fontFamily: fontFamily.monoRegular,
                    fontSize: typeScale.mono.fontSize,
                    letterSpacing: typeScale.mono.letterSpacing,
                    color: colors.fgMuted,
                  }}
                >
                  {' USD'}
                </Text>
              </Text>
            )}
            {!unavailable && change !== undefined && (
              <View
                style={{
                  alignSelf: 'flex-start',
                  borderRadius: 6,
                  paddingHorizontal: 6,
                  paddingVertical: 2,
                  backgroundColor: BG_SURFACE_NESTED,
                }}
              >
                <Text
                  testID="price.change"
                  style={{
                    fontFamily: fontFamily.monoMedium,
                    fontSize: 12,
                    color: changeColor,
                  }}
                >
                  {arrow +
                    (translate('price.change') as string).replace(
                      '{pct}',
                      formatChangePct(change),
                    )}
                </Text>
              </View>
            )}
          </View>
          {!unavailable && !!zecPrice.sparklineUsd && (
            <Sparkline
              testID="price.sparkline"
              points={zecPrice.sparklineUsd}
              width={96}
              height={40}
              color={greyed ? colors.fgMuted : colors.fgAccent}
            />
          )}
        </View>

        <Text
          testID="price.meta"
          style={{
            fontFamily: fontFamily.monoRegular,
            fontSize: 11,
            color: colors.fgMuted,
          }}
        >
          {meta}
        </Text>
        {noteOpen && (
          <Text
            testID="price.note"
            style={{
              fontFamily: fontFamily.bodyRegular,
              fontSize: 12,
              lineHeight: 17,
              color: colors.fgMuted,
            }}
          >
            {translate('price.note') as string}
          </Text>
        )}
      </Pressable>
    );
  },
);

export default PriceRow;
