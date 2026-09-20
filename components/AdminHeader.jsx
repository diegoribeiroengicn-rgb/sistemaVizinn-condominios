"use client";

import Link from "next/link";
import { useAuth } from "@/hooks/useAuth";

export default function AdminHeader() {
  const { user, logout } = useAuth();

  return (
    <header className="border-b border-navy-100 bg-navy-900">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 sm:px-6">
        <div className="flex items-center gap-3">
          <span className="font-display text-lg font-bold text-white">Vizinn</span>
          <span className="rounded-full bg-coral px-3 py-0.5 text-xs font-semibold text-white">
            Admin
          </span>
        </div>

        <div className="flex items-center gap-3">
          <span className="hidden text-sm text-cream-100/70 sm:inline">{user?.email}</span>
          <Link href="/dashboard" className="btn-ghost text-cream-100 hover:bg-white/10">
            Meu condomínio
          </Link>
          <button onClick={logout} className="btn-secondary border-white text-white hover:bg-white hover:text-navy-900">
            Sair
          </button>
        </div>
      </div>
    </header>
  );
}
