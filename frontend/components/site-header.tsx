"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { useAuth } from "@/components/auth-provider";

type SiteHeaderProps = {
  showAnchorLinks?: boolean;
};

const landingLinks = [
  { label: "Home", href: "/#home" },
  { label: "About", href: "/#about" },
  { label: "Classes", href: "/#classes" },
  { label: "Pricing", href: "/pricing" },
  { label: "Gallery", href: "/#gallery" },
  { label: "Contact", href: "/#contact" },
];

export function SiteHeader({ showAnchorLinks = true }: SiteHeaderProps) {
  const pathname = usePathname();
  const { user } = useAuth();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [dashboardHref, setDashboardHref] = useState<string | null>(null);

  useEffect(() => {
    if (!user) {
      setDashboardHref(null);
      return;
    }

    setDashboardHref(`/${user.role}/dashboard`);
  }, [pathname, user]);

  const primaryAction = useMemo(() => {
    if (dashboardHref) {
      return {
        href: dashboardHref,
        label: "Dashboard",
      };
    }

    return {
      href: "/login",
      label: "Login",
    };
  }, [dashboardHref]);

  return (
    <header className="rounded-[2rem] border border-slate-100 bg-white/95 px-5 py-4 shadow-soft backdrop-blur sm:px-6">
      <div className="flex items-center justify-between gap-4">
        <Link href="/" className="flex min-w-0 items-center gap-3">
          <Image
            src="/images/logo.png"
            alt="We Are Kids Nursery"
            width={56}
            height={56}
            className="h-11 w-auto object-contain"
            priority
          />
          <div className="min-w-0">
            <p className="truncate text-base font-bold text-slate-800 sm:text-lg">
              We Are Kids Nursery
            </p>
            <p className="truncate text-xs text-slate-500 sm:text-sm">
              Bright online learning for young minds
            </p>
          </div>
        </Link>

        <div className="hidden items-center gap-3 lg:flex">
          {showAnchorLinks ? (
            <nav className="flex items-center gap-2 rounded-full border border-slate-100 bg-slate-50 px-2 py-2 text-sm font-medium text-slate-600">
              {landingLinks.map((link) => {
                const isActive = pathname === "/" && link.href === "/#home";

                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    className={`rounded-full px-4 py-2 transition ${
                      isActive
                        ? "bg-white text-blue-700 shadow-sm"
                        : "text-slate-600 hover:bg-white hover:text-slate-800"
                    }`}
                  >
                    {link.label}
                  </Link>
                );
              })}
            </nav>
          ) : null}

          <Link
            href={primaryAction.href}
            className={`inline-flex items-center justify-center rounded-full px-5 py-3 text-sm font-semibold transition ${
              pathname === primaryAction.href
                ? "bg-blue-600 text-white shadow-lg shadow-blue-100"
                : "bg-red-500 text-white shadow-lg shadow-red-100 hover:-translate-y-0.5"
            }`}
          >
            {primaryAction.label}
          </Link>
        </div>

        <button
          type="button"
          onClick={() => setIsMenuOpen((currentValue) => !currentValue)}
          className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 lg:hidden"
          aria-label="Toggle menu"
          aria-expanded={isMenuOpen}
        >
          <span className="flex flex-col gap-1.5">
            <span className="h-0.5 w-5 rounded-full bg-current" />
            <span className="h-0.5 w-5 rounded-full bg-current" />
            <span className="h-0.5 w-5 rounded-full bg-current" />
          </span>
        </button>
      </div>

      {isMenuOpen ? (
        <div className="mt-4 space-y-3 border-t border-slate-100 pt-4 lg:hidden">
          {showAnchorLinks ? (
            <nav className="grid gap-2">
              {landingLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setIsMenuOpen(false)}
                  className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700"
                >
                  {link.label}
                </Link>
              ))}
            </nav>
          ) : null}
          <Link
            href={primaryAction.href}
            onClick={() => setIsMenuOpen(false)}
            className="inline-flex w-full items-center justify-center rounded-full bg-red-500 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-red-100"
          >
            {primaryAction.label}
          </Link>
        </div>
      ) : null}
    </header>
  );
}
