import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "планер — дела на своих местах",
  description: "Личный план на день и неделю. Проекты и задачи на всех устройствах.",
  manifest: "/manifest.webmanifest",
  referrer: "no-referrer",
  appleWebApp: { capable: true, title: "планер", statusBarStyle: "default" },
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
    apple: "/icon-180.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ru">
      <body>{children}</body>
    </html>
  );
}
