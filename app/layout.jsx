import { Inter, Libre_Baskerville } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/hooks/useAuth";
import { THEME_INIT_SCRIPT } from "@/lib/theme";

const sans = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

const display = Libre_Baskerville({
  subsets: ["latin"],
  weight: ["400", "700"],
  variable: "--font-display",
  display: "swap",
});

export const metadata = {
  title: "Vizinn | Condomínio Inteligente",
  description:
    "Vizinn simplifica a administração condominial: boletos automáticos, portal do condômino 24/7 e IA assistente, sem intermediários.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="pt-BR" className={`${sans.variable} ${display.variable}`}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className="min-h-screen bg-cream-50 font-sans text-navy-900 antialiased">
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
