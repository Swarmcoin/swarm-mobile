import React from 'react';
import { Text, TextStyle } from 'react-native';
import { useTheme } from '@app/theme';
import {
  fontFamily,
  MASKED_AMOUNT,
  MASKED_LETTER_SPACING,
  typeScale,
} from '@app/theme/typography';
import ZecPriceType from '@app/AppState/types/ZecPriceType';
import { usePriceFreshness } from './priceFetcherStore';
import { formatUsd } from './swmPriceFormat';

type SwmFiatValueProps = {
  amount: number;
  price: ZecPriceType;
  privacy: boolean;
  accessibilityLabel: string;
  style?: TextStyle;
  testID?: string;
};

/** An SWM amount at the current price as `≈ $9,364.10 USD`, greyed once the price ages. */
const SwmFiatValue = ({
  amount,
  price,
  privacy,
  accessibilityLabel,
  style,
  testID,
}: SwmFiatValueProps) => {
  const { colors } = useTheme();
  const freshness = usePriceFreshness(price);
  if (freshness === 'absent' || freshness === 'unavailable') {
    return <></>;
  }
  const value = privacy ? MASKED_AMOUNT : formatUsd(amount * price.zecPrice);
  const shown = `≈ $${value} USD`;
  return (
    <Text
      testID={testID}
      accessibilityLabel={
        privacy ? accessibilityLabel : `${accessibilityLabel} ${shown}`
      }
      style={[
        {
          fontFamily: fontFamily.monoRegular,
          fontSize: typeScale.mono.fontSize,
          letterSpacing: privacy
            ? MASKED_LETTER_SPACING
            : typeScale.mono.letterSpacing,
          color: freshness === 'fresh' ? colors.fgMuted : colors.bgMuted,
        },
        style,
      ]}
    >
      {shown}
    </Text>
  );
};

export default SwmFiatValue;
