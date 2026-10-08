import React from "react";
import { IONICONS } from "./icons/ionicons";

/** Alias cho tên icon RN dùng nhưng không có trong ionicons@7 */
const ALIASES: Record<string, string> = {
  radar: "pulse",
  "bell-outline": "notifications-outline",
  "flash-alert": "warning",
};

export type IconName = string;

interface IconProps {
  name: IconName;
  size?: number;
  color?: string;
  style?: React.CSSProperties;
  className?: string;
}

/**
 * Ionicons SVG — glyph chính xác như @expo/vector-icons (Ionicons) trên RN.
 * color truyền qua CSS `color` (SVG dùng currentColor).
 */
export const Icon: React.FC<IconProps> = ({ name, size = 24, color = "#000", style, className }) => {
  const resolved = ALIASES[name] ?? name;
  const svg = IONICONS[resolved] ?? IONICONS[name];
  if (!svg) {
    // Glyph thiếu: fallback vòng tròn mờ — không crash app
    return (
      <span
        className={className}
        style={{
          display: "inline-block",
          width: size,
          height: size,
          borderRadius: "50%",
          border: `2px solid ${color}`,
          opacity: 0.5,
          ...style,
        }}
      />
    );
  }
  return (
    <svg
      viewBox="0 0 512 512"
      width={size}
      height={size}
      className={className}
      style={{ color, flexShrink: 0, ...style }}
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
};

export default Icon;
