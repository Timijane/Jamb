import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "JAMBMASTER",
  description:
    "A complete JAMB preparation platform for learning, CBT practice, competition and performance improvement.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
