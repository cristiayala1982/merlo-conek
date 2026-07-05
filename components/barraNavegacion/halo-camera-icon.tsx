import Svg, { Circle, Path, Rect } from 'react-native-svg';

type HaloCameraIconProps = {
  size?: number;
  color?: string;
  strokeWidth?: number;
};

export function HaloCameraIcon({
  size = 28,
  color = '#333333',
  strokeWidth = 0.85,
}: HaloCameraIconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M5.1 12a7.45 7.45 0 0 1 10-7.05"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
      />
      <Path
        d="M18.35 8.55A7.45 7.45 0 0 1 13.25 19"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
      />
      <Path
        d="M12.15 19.25A7.45 7.45 0 0 1 5.15 12.95"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
      />

      <Path
        d="m19.15 4.25.25.78c.08.24.26.42.5.5l.78.25-.78.25a.8.8 0 0 0-.5.5l-.25.78-.25-.78a.8.8 0 0 0-.5-.5l-.78-.25.78-.25c.24-.08.42-.26.5-.5z"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinejoin="round"
        strokeLinecap="round"
      />

      <Rect
        x="6.9"
        y="8.6"
        width="10.2"
        height="7"
        rx="1.65"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinejoin="round"
      />
      <Path
        d="M9.8 8.6 10.6 7.4h2.8l.8 1.2"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Circle cx="12" cy="12.1" r="2.1" stroke={color} strokeWidth={strokeWidth} />
      <Circle cx="15.45" cy="10.45" r="0.3" fill={color} />
    </Svg>
  );
}