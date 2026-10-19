import type { Metadata, Viewport } from "next";
import { JetBrains_Mono, Onest, Unbounded } from "next/font/google";
import { AppShell } from "@/components/AppShell";
import { ThemeProvider } from "@/components/ThemeProvider";
import { loadRecoveryScript } from "@/lib/pwa";
import { DEFAULT_ACCENT, DEFAULT_THEME, themeInitScript } from "@/lib/theme";
import "./globals.css";

// Fonts are downloaded at build time and served from our own origin: no third-party requests, works offline.
const unbounded = Unbounded({ subsets: ["latin", "cyrillic"], variable: "--font-unbounded" });
const onest = Onest({ subsets: ["latin", "cyrillic"], variable: "--font-onest" });
const jetbrains = JetBrains_Mono({ subsets: ["latin", "cyrillic"], variable: "--font-jetbrains" });

// GitHub Pages serves the app under /<repo>; metadata URLs are not prefixed by Next automatically.
const base = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

export const metadata: Metadata = {
  title: "Спорт трекер",
  description: "Личный дневник тренировок и замеров. Данные хранятся только на телефоне.",
  // Written by scripts/build-pwa.mjs after `next build` (absent in `npm run dev`).
  manifest: `${base}/manifest.webmanifest`,
  icons: {
    icon: [{ url: `${base}/icons/favicon-32.png`, sizes: "32x32", type: "image/png" }],
    apple: [{ url: `${base}/icons/apple-touch-icon.png`, sizes: "180x180" }],
  },
  appleWebApp: { capable: true, title: "Спорт трекер", statusBarStyle: "default" },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  // Android Chrome: the keyboard shrinks the page instead of covering bottom sheets.
  interactiveWidget: "resizes-content",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="ru"
      data-theme={DEFAULT_THEME}
      data-accent={DEFAULT_ACCENT}
      data-mode="light"
      suppressHydrationWarning
      className={`${unbounded.variable} ${onest.variable} ${jetbrains.variable} antialiased`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: loadRecoveryScript }} />
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body>
        <ThemeProvider>
          <AppShell>{children}</AppShell>
        </ThemeProvider>
      </body>
    </html>
  );
}
