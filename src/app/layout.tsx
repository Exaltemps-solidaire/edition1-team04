import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Brouillon de rapport — La Sauvegarde du Nord",
  description:
    "Génère une première version de rapport AEMO/MJIE à partir de notes de terrain.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr">
      <body>{children}</body>
    </html>
  );
}
