import type { IconProps } from "../types";

export function IconSol({ size = 16, className }: IconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 16 16"
      className={className}
      style={{ verticalAlign: "middle", flexShrink: 0 }}
    >
      <circle cx="8" cy="8" r="8" fill="#14151a" />
      <path
        d="M4 11.2h6.5l1.5 1.5H5.5L4 11.2zm1.5-3.6H12l-1.5-1.5H4l1.5 1.5zm6.5-3.6H5.5L4 2.5h6.5l1.5 1.5z"
        fill="url(#solGrad)"
      />
      <defs>
        <linearGradient id="solGrad" x1="4" y1="2.5" x2="12" y2="12.7" gradientUnits="userSpaceOnUse">
          <stop stopColor="#00FFA3" />
          <stop offset="1" stopColor="#DC1FFF" />
        </linearGradient>
      </defs>
    </svg>
  );
}
