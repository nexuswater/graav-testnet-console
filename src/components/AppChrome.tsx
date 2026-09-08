"use client";

import type { ReactNode } from "react";
import { AppShell, type ShellSection } from "@/components/shell/AppShell";

export function AppChrome({
  children,
  active,
}: {
  children: ReactNode;
  active?: ShellSection;
  /** @deprecated pill nav removed */
  showTabsNav?: boolean;
}) {
  return <AppShell active={active}>{children}</AppShell>;
}
