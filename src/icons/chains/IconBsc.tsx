import type { IconProps } from "../types";

export function IconBsc({ size = 16, className }: IconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 16 16"
      className={className}
      style={{ verticalAlign: "middle", flexShrink: 0 }}
    >
      <circle cx="8" cy="8" r="8" fill="#f0b90b" />
      <path
        fill="#ffffff"
        d="M8 3.5l1.6 1.6-1.6 1.6-1.6-1.6L8 3.5zm-3.2 3.2l1.6 1.6-1.6 1.6-1.6-1.6 1.6-1.6zm6.4 0l1.6 1.6-1.6 1.6-1.6-1.6 1.6-1.6zM8 7.3l1.6 1.6-1.6 1.6-1.6-1.6L8 7.3zm0 3.8l1.6 1.6-1.6 1.6-1.6-1.6 1.6-1.6z"
      />
    </svg>
  );
}
