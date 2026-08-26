import type { IconProps } from "../types";

export function IconEth({ size = 16, className }: IconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 16 16"
      className={className}
      data-icon="IconWeth16pxS"
      style={{ verticalAlign: "middle", flexShrink: 0 }}
    >
      <circle cx="8" cy="8" r="8" fill="#4d84f7" />
      <path fill="#fff" d="m7.9782 3.2-.0636.2162v6.2723l.0636.0635 2.9114-1.721z" />
      <path fill="#c3cef6" d="M7.9784 3.2002 5.067 8.0312 7.9784 9.752z" />
      <path fill="#fff" d="m7.9785 10.303-.0359.0437v2.2343l.0359.1047 2.9132-4.1028z" />
      <path fill="#c3cef6" d="M7.9784 12.6857V10.303L5.067 8.5829z" />
      <path fill="#c3cef6" d="m7.978 9.7518 2.9115-1.721L7.978 6.7074z" />
      <path fill="#859bef" d="m5.0669 8.0308 2.9115 1.721V6.7074z" />
    </svg>
  );
}
