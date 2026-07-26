// The drawn icon set, ported one-for-one from the prototype's SVG symbols.
//
// The whole point of a hand-drawn set over SF Symbols is that it reads as a
// set: one stroke weight, round caps and joins, no fills. Apple's symbols
// are drawn to Apple's rules, not ours — mixing them in makes the chrome
// look assembled rather than designed. Same reason there's no emoji here.
//
// Stroke scales in three steps the way it does on the web (1.7 at 22px,
// 1.9 at 16, 2 at 13): a hairline that looks right at tab size goes
// invisible inline with text, so the smaller the icon, the heavier it draws.
import Svg, { Circle, Path, Rect } from 'react-native-svg';

export type IconName =
  | 'compass'
  | 'sprout'
  | 'chart'
  | 'user'
  | 'x'
  | 'chev'
  | 'check'
  | 'plus'
  | 'out'
  | 'flame'
  | 'heart'
  | 'trophy'
  | 'lock'
  | 'sliders'
  | 'link'
  | 'book'
  | 'note'
  | 'shop'
  | 'tag'
  | 'spark';

export type IconProps = {
  name: IconName;
  /** Matches the web sizes: 22 for tabs, 16 inline with text, 13 for the brand mark. */
  size?: number;
  /** Required: React Native has no `currentColor` to inherit from. */
  color: string;
  /** Override the size-derived weight — the active tab draws at 2 to feel pressed. */
  strokeWidth?: number;
  /** Only `heart` fills, and only to show something is saved to the shelf. */
  filled?: boolean;
};

/** The three steps the web set uses, rather than a smooth ratio. */
function weightFor(size: number) {
  if (size <= 13) return 2;
  if (size <= 16) return 1.9;
  return 1.7;
}

export function Icon({ name, size = 22, color, strokeWidth, filled }: IconProps) {
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={strokeWidth ?? weightFor(size)}
      strokeLinecap="round"
      strokeLinejoin="round">
      {shapes(name, filled ? color : 'none')}
    </Svg>
  );
}

function shapes(name: IconName, fill: string) {
  switch (name) {
    case 'compass':
      return (
        <>
          <Circle cx={12} cy={12} r={9} />
          <Path d="M15.6 8.4l-2 5.2-5.2 2 2-5.2z" />
        </>
      );
    case 'sprout':
      return (
        <>
          <Path d="M12 21v-7" />
          <Path d="M12 14c0-3.3-2.7-6-6-6H4c0 3.3 2.7 6 6 6z" />
          <Path d="M12 12c0-3.3 2.7-6 6-6h2c0 3.3-2.7 6-6 6z" />
        </>
      );
    case 'chart':
      return (
        <>
          <Path d="M4 20V10" />
          <Path d="M10 20V4" />
          <Path d="M16 20v-6" />
          <Path d="M22 20H2" />
        </>
      );
    case 'user':
      return (
        <>
          <Circle cx={12} cy={8} r={3.6} />
          <Path d="M5 20c0-3.6 3.1-6 7-6s7 2.4 7 6" />
        </>
      );
    case 'x':
      return <Path d="M6 6l12 12M18 6L6 18" />;
    case 'chev':
      return <Path d="M6 9l6 6 6-6" />;
    case 'check':
      return <Path d="M5 13l4.5 4.5L19 7" />;
    case 'plus':
      return <Path d="M12 5v14M5 12h14" />;
    case 'out':
      return (
        <>
          <Path d="M8 16L16 8" />
          <Path d="M9 8h7v7" />
        </>
      );
    case 'flame':
      return <Path d="M12 21c3.6 0 6-2.4 6-5.6 0-4.2-4.4-5.6-3.4-10.4C11.4 6 9 8.4 9 11c0-1.2-.6-2.2-1.4-2.8C6.6 9.6 6 11.6 6 13.8 6 18 8.4 21 12 21z" />;
    case 'heart':
      return <Path d="M12 20s-7-4.4-7-9a4 4 0 017-2.6A4 4 0 0119 11c0 4.6-7 9-7 9z" fill={fill} />;
    case 'trophy':
      return (
        <>
          <Path d="M8 4h8v5a4 4 0 01-8 0z" />
          <Path d="M8 5H5v2a3 3 0 003 3" />
          <Path d="M16 5h3v2a3 3 0 01-3 3" />
          <Path d="M12 13v4M9 20h6" />
        </>
      );
    case 'lock':
      return (
        <>
          <Rect x={5} y={11} width={14} height={9} rx={2} />
          <Path d="M8.5 11V8a3.5 3.5 0 017 0v3" />
        </>
      );
    case 'sliders':
      return (
        <>
          <Path d="M4 7h11M19 7h1M4 17h4M12 17h8" />
          <Circle cx={17} cy={7} r={2} />
          <Circle cx={10} cy={17} r={2} />
        </>
      );
    case 'link':
      return (
        <>
          <Path d="M10 13.5a3.5 3.5 0 005 0l3-3a3.5 3.5 0 00-5-5l-1 1" />
          <Path d="M14 10.5a3.5 3.5 0 00-5 0l-3 3a3.5 3.5 0 005 5l1-1" />
        </>
      );
    case 'book':
      return (
        <>
          <Path d="M5 4h9a3 3 0 013 3v13H8a3 3 0 01-3-3z" />
          <Path d="M5 17h12" />
        </>
      );
    case 'note':
      return (
        <>
          <Rect x={3} y={7} width={18} height={10} rx={2} />
          <Circle cx={12} cy={12} r={2.4} />
        </>
      );
    case 'shop':
      return (
        <>
          <Path d="M4 9h16l-1 11H5z" />
          <Path d="M8.5 9V6.5a3.5 3.5 0 017 0V9" />
        </>
      );
    case 'tag':
      return (
        <>
          <Path d="M4 11V5h6l9 9-6 6z" />
          <Circle cx={7.8} cy={8.2} r={1.1} />
        </>
      );
    case 'spark':
      return (
        <>
          <Path d="M12 3l1.9 5.6L19.5 10l-5.6 1.9L12 17.5l-1.9-5.6L4.5 10l5.6-1.4z" />
          <Path d="M18.5 16l.7 2 2 .7-2 .7-.7 2-.7-2-2-.7 2-.7z" />
        </>
      );
  }
}
