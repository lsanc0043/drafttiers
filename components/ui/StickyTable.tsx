import type { ReactNode } from "react";

export const STICKY_TH_CLASS =
  "sticky top-0 z-20 bg-background border-b border-zinc-200 dark:border-zinc-800";

type StickyTableProps = {
  children: ReactNode;
  className?: string;
  tableClassName?: string;
};

export function StickyTable({
  children,
  className = "",
  tableClassName = "",
}: StickyTableProps) {
  return (
    <div className={`overflow-auto overscroll-contain ${className}`}>
      <table className={`w-full border-separate border-spacing-0 text-sm ${tableClassName}`}>
        {children}
      </table>
    </div>
  );
}
