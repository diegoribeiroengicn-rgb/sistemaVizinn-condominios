import Image from "next/image";
import Link from "next/link";

// Cabeçalho das páginas públicas do blog — sem estado nenhum (Server
// Component), diferente de components/Header.jsx (que depende de
// useAuth pros botões de login/signup da landing page). Aqui os
// botões só levam de volta pra home, onde os modais reais vivem.
export default function BlogHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-navy-100 bg-cream-50/90 backdrop-blur">
      <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-4 sm:px-6">
        <Link href="/" className="flex items-center gap-2">
          <Image src="/brand/aquihabitto-mark.png" alt="AquiHabitto" width={34} height={34} className="rounded-lg" />
          <span className="flex flex-col">
            <span className="font-display text-xl font-bold leading-none tracking-tight text-navy-900">
              Aqui
              <br />
              Habitto<span className="ml-1 inline-block h-[2px] w-[2px] translate-y-1 align-middle bg-coral" />
            </span>
            <span className="mt-1 h-0.5 w-8 bg-coral" />
          </span>
        </Link>
        <nav className="flex items-center gap-2 sm:gap-3">
          <Link href="/blog" className="btn-ghost">
            Blog
          </Link>
          <Link href="/" className="btn-primary">
            Conhecer o AquiHabitto
          </Link>
        </nav>
      </div>
    </header>
  );
}
