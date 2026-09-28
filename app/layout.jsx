import { Inter, Libre_Baskerville } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/hooks/useAuth";
import { THEME_INIT_SCRIPT } from "@/lib/theme";
import ChatbotWidget from "@/components/ChatbotWidget";
import RegisterServiceWorker from "@/components/RegisterServiceWorker";

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

const SITE_URL = "https://www.vizinn.com.br";
const DESCRICAO =
  "Habittum é o sistema de condomínio inteligente: notificações automáticas por WhatsApp e e-mail, portal do condômino 24/7 e relatórios profissionais em PDF e Word, sem intermediários.";

export const metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "Habittum | Condomínio Inteligente",
    template: "%s | Habittum",
  },
  description: DESCRICAO,
  keywords: [
    "Habittum",
    "condomínio inteligente",
    "sistema de gestão condominial",
    "software para condomínio",
    "gestão de condomínio",
    "portal do condômino",
  ],
  applicationName: "Habittum",
  authors: [{ name: "Habittum" }],
  robots: { index: true, follow: true },
  alternates: { canonical: "/" },
  icons: {
    icon: "/icon.png",
    apple: "/icons/apple-touch-icon.png",
  },
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Habittum",
  },
  openGraph: {
    type: "website",
    locale: "pt_BR",
    url: SITE_URL,
    siteName: "Habittum",
    title: "Habittum | Condomínio Inteligente",
    description: DESCRICAO,
    images: [{ url: "/brand/vizinn-logo-horizontal.png", width: 300, height: 87, alt: "Habittum" }],
  },
  twitter: {
    card: "summary",
    title: "Habittum | Condomínio Inteligente",
    description: DESCRICAO,
    images: ["/brand/vizinn-logo-horizontal.png"],
  },
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#0a1f3f",
};

export default function RootLayout({ children }) {
  return (
    <html lang="pt-BR" className={`${sans.variable} ${display.variable}`}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className="min-h-screen bg-cream-50 font-sans text-navy-900 antialiased">
        <AuthProvider>
          {children}
          <ChatbotWidget />
        </AuthProvider>
        <RegisterServiceWorker />
      </body>
    </html>
  );
}
