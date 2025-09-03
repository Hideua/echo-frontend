import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Echo",
  description: "Messages that outlive us",
  icons: { icon: "/favicon.ico", apple: "/apple-touch-icon.png" },
};

export default function RootLayout({
  children,
}: { children: React.ReactNode }) {
  return (
    <html lang="ru">
      <body className="antialiased bg-white text-black scroll-smooth">
        {children}
      </body>
    </html>
  );
}
