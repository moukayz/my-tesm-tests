import type { Metadata } from "next";
import "./globals.css";
import { Fraunces, Plus_Jakarta_Sans } from "next/font/google";
import { AppProviders } from "./providers";
import { AppShell } from "@/shared/ui/app-shell";

const heading = Fraunces({
  subsets: ["latin"],
  variable: "--font-heading",
});

const body = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-body",
});

export const metadata: Metadata = {
  title: "Blog Website",
  description: "A simple multi-user blog.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${heading.variable} ${body.variable}`}>
        <AppProviders>
          <AppShell>{children}</AppShell>
        </AppProviders>
      </body>
    </html>
  );
}
