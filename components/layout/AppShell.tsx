import type { ReactNode } from "react";
import { Navbar } from "@/components/layout/Navbar";

type AppShellProps = {
  children: ReactNode;
};

export function AppShell({ children }: AppShellProps) {
  return (
    <div className="flex min-h-full flex-col">
      <Navbar />
      <div className="flex-1">{children}</div>
    </div>
  );
}
