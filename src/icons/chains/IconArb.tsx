import type { IconProps } from "../types";

export function IconArb({ size = 16, className }: IconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 16 16"
      className={className}
      style={{ verticalAlign: "middle", flexShrink: 0 }}
    >
      <circle cx="8" cy="8" r="8" fill="#28a0f0" />
      <path
        fill="#ffffff"
        d="M8 3.5l3.5 6-1.5 2.5L8 9.5l-2 2.5-1.5-2.5 3.5-6z"
      />
    </svg>
  );
}
