type IconProps = { size?: number; className?: string };

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

export function IconWallet({ size = 18, className }: IconProps) {
  return (
    <svg width={size} height={size} className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M19 7H5a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2z" />
      <path d="M17 14h.01" /><path d="M3 10h18" />
    </svg>
  );
}

export function IconShield({ size = 18, className }: IconProps) {
  return (
    <svg width={size} height={size} className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  );
}

export function IconSearch({ size = 16, className }: IconProps) {
  return (
    <svg width={size} height={size} className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" />
    </svg>
  );
}

export function IconScan({ size = 16, className }: IconProps) {
  return (
    <svg width={size} height={size} className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round">
      <path d="M3 7V5a2 2 0 0 1 2-2h2" /><path d="M17 3h2a2 2 0 0 1 2 2v2" />
      <path d="M21 17v2a2 2 0 0 1-2 2h-2" /><path d="M7 21H5a2 2 0 0 1-2-2v-2" />
      <path d="M7 12h10" />
    </svg>
  );
}

export function IconImport({ size = 16, className }: IconProps) {
  return (
    <svg width={size} height={size} className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3v12" /><path d="m7 10 5 5 5-5" /><path d="M5 21h14" />
    </svg>
  );
}

export function IconWalletImport({ size = 24, className }: IconProps) {
  return (
    <svg width={size} height={size} className={className} viewBox="0 0 24 24" fill="none">
      <rect x="3" y="6" width="18" height="13" rx="3" fill="currentColor" opacity="0.14" />
      <path
        d="M19 8H5a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7a2 2 0 0 0-2-2z"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M3 11h18" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
      <circle cx="17" cy="14.5" r="1" fill="currentColor" />
      <path
        d="M12 3v6m0 0-2.5-2.5M12 9l2.5-2.5"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function IconFolder({ size = 16, className }: IconProps) {
  return (
    <svg width={size} height={size} className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7l-2-2H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2z" />
    </svg>
  );
}

export function IconUpload({ size = 16, className }: IconProps) {
  return (
    <svg width={size} height={size} className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3v12" /><path d="m7 8 5-5 5 5" /><path d="M5 21h14" />
    </svg>
  );
}

export function IconExport({ size = 16, className }: IconProps) {
  return (
    <svg width={size} height={size} className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 15V3" /><path d="m7 8 5-5 5 5" /><path d="M5 21h14" />
    </svg>
  );
}

export function IconLock({ size = 16, className }: IconProps) {
  return (
    <svg width={size} height={size} className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" />
    </svg>
  );
}

export function IconKey({ size = 16, className }: IconProps) {
  return (
    <svg width={size} height={size} className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="8" cy="15" r="4" /><path d="m10.5 12.5 21 2" /><path d="M18 5l3 3" />
    </svg>
  );
}

export function IconSeed({ size = 16, className }: IconProps) {
  return (
    <svg width={size} height={size} className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22c-4-3-7-7-7-11a7 7 0 0 1 14 0c0 4-3 8-7 11z" /><path d="M12 11v6" />
    </svg>
  );
}