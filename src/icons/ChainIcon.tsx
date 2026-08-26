import type { IconProps } from "./types";
import { IconEth } from "./chains/IconEth";
import { IconBsc } from "./chains/IconBsc";
import { IconSol } from "./chains/IconSol";
import { IconBase } from "./chains/IconBase";
import { IconArb } from "./chains/IconArb";

export function ChainIcon({ chain, size = 16, className }: { chain: string } & IconProps) {
  const c = chain.toLowerCase();
  if (c === "eth" || c === "ethereum") return <IconEth size={size} className={className} />;
  if (c === "bsc" || c === "bnb") return <IconBsc size={size} className={className} />;
  if (c === "sol" || c === "solana") return <IconSol size={size} className={className} />;
  if (c === "base") return <IconBase size={size} className={className} />;
  if (c === "arb" || c === "arbitrum") return <IconArb size={size} className={className} />;
  return null;
}
