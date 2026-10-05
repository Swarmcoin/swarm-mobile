/* eslint-disable react-native/no-inline-styles */
import React, { useState } from 'react';
import { Image, Pressable, Text, View } from 'react-native';
import { faInfoCircle } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-native-fontawesome';
import { useTheme } from '@app/theme';
import { BG_SURFACE_NESTED } from '@app/theme/tokens';
import { fontFamily, typeScale } from '@app/theme/typography';
import { TranslateType } from '@app/AppState';
import ZecPriceType from '@app/AppState/types/ZecPriceType';
import { getSwarmMark } from '@app/utils/ZingoAppData';
import Sparkline from '@ui/primitives/Sparkline';
import {
  usePriceFetcherStore,
  usePriceFreshness,
} from '@ui/widgets/priceFetcherStore';
import { formatChangePct, formatSwmPrice } from '@ui/widgets/swmPriceFormat';
import {
  CHAIN_NAMES,
  changeTone,
  DEX_NAMES,
  freshnessColor,
  priceAgeText,
  SOURCE_NAMES,
  useTick,
} from '@ui/widgets/swmPriceMeta';

type PriceRowProps = {
  translate: (key: string) => TranslateType;
  zecPrice: ZecPriceType;
  shown: boolean;
  onOpen?: () => void;
  onLayout?: (height: number) => void;
};

// Vertical margins on the card. Reported back via onLayout so the parent
// can size its bottom-sheet snap points to cover the whole price block
// (margins included), not just the card itself.
const CARD_MARGIN_TOP = 10;
const CARD_MARGIN_BOTTOM = 12;
const CARD_VERTICAL_MARGINS = CARD_MARGIN_TOP + CARD_MARGIN_BOTTOM;
const META_TICK_MS = 5_000;

const PriceRow = React.memo(
  ({ translate, zecPrice, shown, onOpen, onLayout }: PriceRowProps) => {
    const { colors } = useTheme();
    const freshness = usePriceFreshness(zecPrice);
    const { lastErrorKey } = usePriceFetcherStore();
    const [noteOpen, setNoteOpen] = useState<boolean>(false);
    const live = shown && freshness !== 'absent';
    useTick(META_TICK_MS, live);

    if (!live) {
      return <></>;
    }

    const unavailable = freshness === 'unavailable';
    const greyed = freshness === 'stale' || unavailable;
    const dot = freshnessColor(colors, freshness);
    const change = zecPrice.changePct24h;
    const { arrow, color: changeColor } = changeTone(colors, change);
    const meta = [
      CHAIN_NAMES[zecPrice.pool?.chain ?? 'base'],
      DEX_NAMES[zecPrice.pool?.dex ?? 'uniswap-v4'],
      zecPrice.source ? SOURCE_NAMES[zecPrice.source] : undefined,
      unavailable && lastErrorKey
        ? (translate(lastErrorKey) as string)
        : priceAgeText(translate, zecPrice, freshness),
    ]
      .filter(part => !!part)
      .join(' · ');

    return (
      <Pressable
        testID="price.card"
        accessibilityRole="button"
        accessibilityLabel={translate('price.page.open-acc') as string}
        onPress={onOpen}
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
