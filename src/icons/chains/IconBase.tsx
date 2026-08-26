import type { IconProps } from "../types";

export function IconBase({ size = 16, className }: IconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 16 16"
      className={className}
      style={{ verticalAlign: "middle", flexShrink: 0 }}
    >
      <circle cx="8" cy="8" r="8" fill="#0052ff" />
      <circle cx="8" cy="8" r="4.5" fill="#ffffff" />
    </svg>
  );
}
