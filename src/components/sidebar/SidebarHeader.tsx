import { IconSearch } from "../../icons";

interface SidebarHeaderProps {
  totalWallets: number;
  search: string;
  onSearchChange: (val: string) => void;
}

export function SidebarHeader({
  totalWallets,
  search,
  onSearchChange,
}: SidebarHeaderProps) {
  return (
    <>
      <div className="sidebar-title-row">
        <div className="sidebar-title-left">
          <h2>Wallets Directory</h2>
          <span className="count-badge mono">{totalWallets.toLocaleString()}</span>
        </div>
      </div>

      <div className="search-wrap">
        <IconSearch className="search-icon" />
        <input
          className="search-input"
          placeholder="Search address, label, secret…"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
        />
      </div>
    </>
  );
}
