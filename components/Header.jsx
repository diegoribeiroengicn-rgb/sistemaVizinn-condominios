"use client";

import Image from "next/image";
import Link from "next/link";
import { useAuth } from "@/hooks/useAuth";

const Logo = () => (
  <Link href="/" className="flex items-center gap-3">
    <Image src="/brand/vizinn-mark.png" alt="AquiHabitto" width={52} height={52} className="rounded-xl" />
    <span className="flex flex-col">
      <span className="font-display text-2xl font-bold leading-none tracking-tight text-navy-900">
        Aqui
        <br />
        Habitto<span className="ml-1 inline-block h-2 w-2 align-top bg-coral" />
      </span>
      <span className="mt-1.5 h-0.5 w-10 bg-coral" />
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
