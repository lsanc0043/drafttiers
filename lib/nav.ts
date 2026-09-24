export const navItems = [
  { href: "/", label: "Home" },
  { href: "/boards", label: "Boards" },
  { href: "/players", label: "Players" },
  { href: "/lock-in", label: "Lock In" },
  { href: "/admin", label: "Admin" },
  { href: "/sleeper-test", label: "Sleeper test" },
] as const;

export function isNavItemActive(href: string, pathname: string) {
  if (href === "/") {
    return pathname === "/";
  }

  return pathname === href || pathname.startsWith(`${href}/`);
}
