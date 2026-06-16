import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Line, Polyline, Text as SvgText } from 'react-native-svg';
import type { TrendResult } from '../../../shared/finance';
import { formatAxisMoney } from '../../../shared/uiHelpers';
import { useTheme } from '../theme/ThemeProvider';

/**
 * Month/week/year trend lines for the top categories. Each series is drawn in a
 * distinct color passed via `colorFor`; hidden categories are filtered out by
 * the caller (select-to-show legend).
 */
export function LineChart({
  trend,
  colorFor,
  currency = 'INR'
}: {
  trend: TrendResult;
  colorFor: (category: string) => string;
  currency?: string;
}) {
  const { palette: c } = useTheme();
  const W = 320;
  const H = 180;
  const padL = 44;
  const padR = 12;
  const padT = 12;
  const padB = 26;
  const innerW = W - padL - padR;
  const innerH = H - padT - padB;
  const { labels, categories, max } = trend;
  const stepX = labels.length > 1 ? innerW / (labels.length - 1) : 0;

  const xAt = (index: number) => padL + index * stepX;
  const yAt = (value: number) => padT + innerH - (value / max) * innerH;

  const gridValues = [0, max / 2, max];

  return (
    <View>
      <Svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`}>
        {gridValues.map((value, i) => {
          const y = yAt(value);
          return (
            <React.Fragment key={i}>
              <Line x1={padL} y1={y} x2={W - padR} y2={y} stroke={c.border} strokeWidth={1} />
              <SvgText x={padL - 6} y={y + 3} fontSize={9} fill={c.textDim} textAnchor="end">
                {formatAxisMoney(value, currency)}
              </SvgText>
            </React.Fragment>
          );
        })}

        {labels.map((label, i) => (
          <SvgText key={label + i} x={xAt(i)} y={H - 8} fontSize={9} fill={c.textDim} textAnchor="middle">
            {label}
          </SvgText>
        ))}

        {categories.map((series) => {
          const color = colorFor(series.category);
          const points = series.points.map((value, i) => `${xAt(i)},${yAt(value)}`).join(' ');
          return (
            <React.Fragment key={series.category}>
              <Polyline points={points} fill="none" stroke={color} strokeWidth={2.5} strokeLinejoin="round" />
              {series.points.map((value, i) => (
                <Circle key={i} cx={xAt(i)} cy={yAt(value)} r={2.5} fill={color} />
              ))}
            </React.Fragment>
          );
        })}
      </Svg>
      {categories.length === 0 ? (
        <Text style={[styles.empty, { color: c.textMuted }]}>No trend data for this range.</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  empty: { textAlign: 'center', paddingVertical: 16 }
});
