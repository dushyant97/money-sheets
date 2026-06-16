import React from 'react';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

/**
 * App brand mark matching the web favicon: a purple-gradient rounded square
 * with three bar-chart bars. Used on loading/error screens.
 */
export function BrandMark({ size = 72 }: { size?: number }) {
  const r = size * 0.24;
  const barW = size * 0.13;
  const baseY = size * 0.72;
  const gap = size * 0.075;
  const startX = size * 0.26;
  const bars = [
    { h: size * 0.22, x: startX },
    { h: size * 0.34, x: startX + barW + gap },
    { h: size * 0.46, x: startX + (barW + gap) * 2 }
  ];

  return (
    <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <Defs>
        <LinearGradient id="brandGrad" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor="#7c77ff" />
          <Stop offset="1" stopColor="#9d7bff" />
        </LinearGradient>
      </Defs>
      <Rect x={0} y={0} width={size} height={size} rx={r} fill="url(#brandGrad)" />
      {bars.map((bar, index) => (
        <Rect
          key={index}
          x={bar.x}
          y={baseY - bar.h}
          width={barW}
          height={bar.h}
          rx={barW * 0.3}
          fill="#ffffff"
        />
      ))}
    </Svg>
  );
}
