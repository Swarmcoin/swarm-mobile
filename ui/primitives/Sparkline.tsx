import React from 'react';
import Svg, { Defs, LinearGradient, Path, Stop } from 'react-native-svg';

type SparklineProps = {
  points: number[];
  width: number;
  height: number;
  color: string;
  testID?: string;
};

const PAD = 2;

/** The path of `points` scaled into a width by height box, oldest point on the left. */
export const sparklinePath = (
  points: number[],
  width: number,
  height: number,
): string => {
  const low = Math.min(...points);
  const span = Math.max(...points) - low || 1;
  const step = (width - 2 * PAD) / (points.length - 1);
  return points
    .map((p, i) => {
      const x = PAD + i * step;
      const y = PAD + (1 - (p - low) / span) * (height - 2 * PAD);
      return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(' ');
};

/** A line of recent prices with a soft fill and no axes. */
const Sparkline = ({
  points,
  width,
  height,
  color,
  testID,
}: SparklineProps) => {
  const line = sparklinePath(points, width, height);
  const area = `${line} L${(width - PAD).toFixed(1)} ${height} L${PAD} ${height} Z`;
  return (
    <Svg
      width={width}
      height={height}
      testID={testID}
      accessibilityElementsHidden={true}
      importantForAccessibility="no-hide-descendants"
    >
      <Defs>
        <LinearGradient id="sparkfill" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={color} stopOpacity={0.25} />
          <Stop offset="1" stopColor={color} stopOpacity={0} />
        </LinearGradient>
      </Defs>
      <Path d={area} fill="url(#sparkfill)" />
      <Path d={line} stroke={color} strokeWidth={1.5} fill="none" />
    </Svg>
  );
};

export default Sparkline;
