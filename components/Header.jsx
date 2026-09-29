"use client";

import Image from "next/image";
import Link from "next/link";
import { useAuth } from "@/hooks/useAuth";

const Logo = () => (
  <Link href="/" className="flex items-center gap-2">
    <Image src="/brand/vizinn-mark.png" alt="AquiHabitto" width={34} height={34} className="rounded-lg" />
    <span className="font-display text-xl font-bold tracking-tight text-navy-900">
      AquiHabitto
    </span>
  </Link>
);

export default function Header({ onStart, onLogin }) {
  const { user, loading, isAdmin, logout } = useAuth();

  return (
    <header className="sticky top-0 z-40 border-b border-navy-100 bg-cream-50/90 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 sm:px-6">
        <Logo />
        <nav className="flex items-center gap-2 sm:gap-3">
          <Link href="/blog" className="btn-ghost hidden sm:inline-flex">
            Blog
          </Link>
          {loading ? null : user ? (
            <>
              <Link href="/dashboard" className="btn-ghost hidden sm:inline-flex">
                Dashboard
              </Link>
              {isAdmin && (
                <Link href="/admin" className="btn-ghost hidden sm:inline-flex">
                  Admin
                </Link>
              )}
              <button onClick={logout} className="btn-secondary">
                Sair
              </button>
            </>
          ) : (
            <>
              <button onClick={onLogin} className="btn-ghost">
                Entrar
              </button>
              <button onClick={onStart} className="btn-primary">
                Começar
              </button>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
