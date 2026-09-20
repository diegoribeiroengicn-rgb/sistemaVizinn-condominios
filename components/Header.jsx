"use client";

import Link from "next/link";
import { useAuth } from "@/hooks/useAuth";

const Logo = () => (
  <Link href="/" className="flex items-center gap-2">
    <svg width="34" height="34" viewBox="0 0 1920 1920" fill="none" aria-hidden="true">
      <path
        d="M804 402c40-40 108-12 108 44v378c0 30 12 59 34 80l7 6 7-6c22-21 34-50 34-80V446c0-56 68-84 108-44l236 236c78 78 122 184 122 294v378c0 92-75 167-167 167h-134V1231a153 153 0 0 0-306 0v270H610c-92 0-167-75-167-167V976c0-110 44-216 122-294l239-236z"
        fill="#0a1f3f"
      />
      <circle cx="960" cy="807" r="112" fill="#e45d4e" />
    </svg>
    <span className="font-display text-xl font-bold tracking-tight text-navy-900">
      Vizinn
    </span>
  </Link>
);

export default function Header({ onStart, onLogin }) {
  const { user, loading, logout } = useAuth();

  return (
    <header className="sticky top-0 z-40 border-b border-navy-100 bg-cream-50/90 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 sm:px-6">
        <Logo />
        <nav className="flex items-center gap-2 sm:gap-3">
          {loading ? null : user ? (
            <>
              <Link href="/dashboard" className="btn-ghost hidden sm:inline-flex">
                Dashboard
              </Link>
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
