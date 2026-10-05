import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";

const capriola = localFont({
  src: "./fonts/Capriola.ttf",
  variable: "--font-capriola",
  weight: "300 700",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Caption Club",
  description: "Small words. Big personality. A place for your point of view.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`h-full antialiased ${capriola.variable}`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
