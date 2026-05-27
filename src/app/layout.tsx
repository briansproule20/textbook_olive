import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "iso-game",
  description: "Isometric multiplayer character game scaffold",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
