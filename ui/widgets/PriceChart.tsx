import React, { useState } from 'react';
import { GestureResponderEvent, StyleSheet, Text, View } from 'react-native';
import Svg, { Defs, LinearGradient, Path, Stop } from 'react-native-svg';
import { useTheme } from '@app/theme';
import { fontFamily } from '@app/theme/typography';
import { formatSwmPrice } from './swmPriceFormat';

export type ChartPoint = { usd: number; unix: number; live?: boolean };

type PriceChartProps = {
  points: ChartPoint[];
  height: number;
  color: string;
  formatTime: (unix: number) => string;
  nowLabel: string;
  accessibilityLabel: string;
  testID?: string;
};

const PAD_X = 4;
const PAD_Y = 18;
const LABEL_W = 72;

/** Screen coordinates of `points` in a width by height box, leaving room for the edge labels. */
export const chartXY = (
  points: ChartPoint[],
  width: number,
  height: number,
): { x: number; y: number }[] => {
  const values = points.map(p => p.usd);
  const low = Math.min(...values);
  const span = Math.max(...values) - low || 1;
  const step = (width - LABEL_W - 2 * PAD_X) / Math.max(points.length - 1, 1);
  return points.map((p, i) => ({
    x: PAD_X + i * step,
    y: PAD_Y + (1 - (p.usd - low) / span) * (height - 2 * PAD_Y),
  }));
};

const pathOf = (xy: { x: number; y: number }[]): string =>
  xy
    .map(
      ({ x, y }, i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)} ${y.toFixed(1)}`,
    )
    .join(' ');

/** The index of the point nearest to `x`. */
export const nearestIndex = (
  xy: { x: number; y: number }[],
  x: number,
): number =>
  xy.reduce(
    (best, p, i) => (Math.abs(p.x - x) < Math.abs(xy[best].x - x) ? i : best),
    0,
  );

/** A taller price line with a soft fill, edge labels and a touch-drag readout. */
const PriceChart = ({
  points,
  height,
  color,
  formatTime,
  nowLabel,
  accessibilityLabel,
  testID,
}: PriceChartProps) => {
  const { colors } = useTheme();
  const [width, setWidth] = useState<number>(320);
  const [picked, setPicked] = useState<number | undefined>();

  const xy = chartXY(points, width, height);
  const line = pathOf(xy);
  const last = xy[xy.length - 1];
  const area = `${line} L${last.x.toFixed(1)} ${height - PAD_Y} L${PAD_X} ${
    height - PAD_Y
  } Z`;
  const values = points.map(p => p.usd);
  const low = Math.min(...values);
  const high = Math.max(...values);
  const guide = (y: number) => `M${PAD_X} ${y} L${width - LABEL_W} ${y}`;

  const pick = (e: GestureResponderEvent) =>
    setPicked(nearestIndex(xy, e.nativeEvent.locationX));

  const mono = { fontFamily: fontFamily.monoRegular, fontSize: 11 };
  const readout = picked === undefined ? undefined : points[picked];

  return (
    <View testID={testID}>
      <Text
        testID="price.chart.readout"
        style={[mono, styles.readout, { color: colors.fgDefault }]}
      >
        {readout
          ? `$${formatSwmPrice(readout.usd)} · ${
              readout.live ? nowLabel : formatTime(readout.unix)
            }`
          : ' '}
      </Text>
      <View
        testID={testID && `${testID}.touch`}
        accessible={true}
        accessibilityLabel={accessibilityLabel}
        onLayout={e => setWidth(e.nativeEvent.layout.width)}
        onStartShouldSetResponder={() => true}
        onMoveShouldSetResponder={() => true}
        onResponderTerminationRequest={() => false}
        onResponderGrant={pick}
        onResponderMove={pick}
        onResponderRelease={() => setPicked(undefined)}
        style={{ height }}
      >
        <Svg width={width} height={height}>
          <Defs>
            <LinearGradient id="chartfill" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={color} stopOpacity={0.25} />
              <Stop offset="1" stopColor={color} stopOpacity={0} />
            </LinearGradient>
          </Defs>
          <Path
            d={`${guide(PAD_Y)} ${guide(height - PAD_Y)}`}
            stroke={colors.borderMuted}
            strokeWidth={1}
            strokeOpacity={0.5}
          />
          <Path d={area} fill="url(#chartfill)" />
          <Path d={line} stroke={color} strokeWidth={1.5} fill="none" />
          {picked !== undefined && (
            <Path
              d={`M${xy[picked].x} ${PAD_Y} L${xy[picked].x} ${height - PAD_Y}`}
              stroke={colors.fgMuted}
              strokeWidth={1}
            />
          )}
        </Svg>
        <Text
          testID="price.chart.high"
          style={[mono, styles.edge, styles.high, { color: colors.fgMuted }]}
        >
          {`$${formatSwmPrice(high)}`}
        </Text>
        <Text
          testID="price.chart.low"
          style={[mono, styles.edge, styles.low, { color: colors.fgMuted }]}
        >
          {`$${formatSwmPrice(low)}`}
        </Text>
        <Text
          testID="price.chart.latest"
          style={[
            mono,
            styles.latest,
            {
              top: Math.max(0, Math.min(last.y - 8, height - 16)),
              left: last.x + 6,
              color,
            },
          ]}
        >
          {`$${formatSwmPrice(points[points.length - 1].usd)}`}
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  readout: { height: 16, marginBottom: 4 },
  edge: { position: 'absolute', left: PAD_X },
  high: { top: 0 },
  low: { bottom: 0 },
  latest: { position: 'absolute' },
});

export default PriceChart;
