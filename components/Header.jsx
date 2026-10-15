"use client";

import Image from "next/image";
import Link from "next/link";
import { useAuth } from "@/hooks/useAuth";

const Logo = () => (
  <Link href="/" className="flex items-center gap-2 sm:gap-3">
    <Image
      src="/brand/aquihabitto-mark.png"
      alt="AquiHabitto"
      width={52}
      height={52}
      className="h-9 w-9 flex-none rounded-xl sm:h-[52px] sm:w-[52px]"
    />
    <span className="flex flex-col">
      <span className="font-display text-base font-bold leading-none tracking-tight text-navy-900 sm:text-2xl">
        Aqui
        <br />
        Habitto<span className="ml-1 inline-block h-1.5 w-1.5 translate-y-1 align-middle bg-coral" />
      </span>
      <span className="mt-1 h-0.5 w-7 bg-coral sm:mt-1.5 sm:w-10" />
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
          <Link href="/#app" className="btn-ghost px-2 text-sm sm:px-4 sm:text-base">
            App
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
              <button onClick={logout} className="btn-secondary px-4 py-2 text-sm sm:px-6 sm:py-3 sm:text-base">
                Sair
              </button>
            </>
          ) : (
            <>
              <button onClick={onLogin} className="btn-ghost px-2 text-sm sm:px-4 sm:text-base">
                Entrar
              </button>
              <button onClick={onStart} className="btn-primary px-4 py-2 text-sm sm:px-6 sm:py-3 sm:text-base">
                Começar
              </button>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
