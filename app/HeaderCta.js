"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

// The header button changes with the page, so a co-parent on an invite link
// or a parent already managing their family isn't pushed to start a new family.
export default function HeaderCta() {
  const path = usePathname() || "/";
  if (path.startsWith("/join")) return null;
  if (path.startsWith("/family")) return null;
  return (
    <Link href="/#signup" className="header-cta">
      Sign up
    </Link>
  );
}
