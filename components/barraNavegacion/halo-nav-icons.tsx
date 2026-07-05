import Svg, { Circle, Path } from 'react-native-svg';

type HaloIconProps = {
  size?: number;
  color?: string;
  strokeWidth?: number;
};

export function HaloBellIcon({
  size = 36,
  color = '#333333',
  strokeWidth = 1.15,
}: HaloIconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M8.1 10.1a3.9 3.9 0 1 1 7.8 0v3.2c0 .58.18 1.14.52 1.62l.78 1.08H6.8l.78-1.08c.34-.48.52-1.04.52-1.62z"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M10.45 17.25a1.55 1.55 0 0 0 3.1 0"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
      />
      <Circle cx="12" cy="6.05" r="0.45" fill={color} />
    </Svg>
  );
}

export function HaloMessageIcon({
  size = 36,
  color = '#333333',
  strokeWidth = 1.15,
}: HaloIconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M6.35 8.25A2.25 2.25 0 0 1 8.6 6h6.8a2.25 2.25 0 0 1 2.25 2.25v4.85a2.25 2.25 0 0 1-2.25 2.25H11l-2.8 2.35v-2.35H8.6a2.25 2.25 0 0 1-2.25-2.25z"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path d="M9.2 10.7h5.6" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
      <Path d="M9.2 12.7h3.85" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
    </Svg>
  );
}

export function HaloOptionsIcon({
  size = 36,
  color = '#333333',
  strokeWidth = 1.15,
}: HaloIconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M7.1 8h9.8" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
      <Path d="M7.1 12h9.8" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
      <Path d="M7.1 16h9.8" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
      <Circle cx="9.1" cy="8" r="0.8" fill={color} />
      <Circle cx="14.9" cy="12" r="0.8" fill={color} />
      <Circle cx="11.5" cy="16" r="0.8" fill={color} />
    </Svg>
  );
}

