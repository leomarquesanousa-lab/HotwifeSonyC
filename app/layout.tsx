import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import type { ReactNode } from "react";
import "./globals.css";
import "@/components/compliance/compliance.css";
import PublicFooter from "@/components/compliance/PublicFooter";
import AgeGate from "@/components/compliance/AgeGate";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://hotwifesonyc.com"),
  title: "HotwifeSonyC",
  description: "Premium videos from the HotwifeSonyC collection.",
  openGraph: {
    title: "HotwifeSonyC · The Private Collection",
    description: "Original visual stories. A unique perspective. Explore the HotwifeSonyC collection.",
    siteName: "HotwifeSonyC",
    url: "https://hotwifesonyc.com",
    type: "website",
    images: [{ url: "/hotwifesonyc-social.jpg", width: 1200, height: 630, alt: "HotwifeSonyC — The Private Collection" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "HotwifeSonyC · The Private Collection",
    description: "Original visual stories. A unique perspective. Explore the HotwifeSonyC collection.",
    images: [{ url: "/hotwifesonyc-social.jpg", alt: "HotwifeSonyC — The Private Collection" }],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}<PublicFooter/><AgeGate/></body>
    </html>
  );
}
