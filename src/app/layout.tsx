import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

export const metadata: Metadata = {
  title: "ReSocial — Post Once, Reach Everywhere",
  description:
    "The #1 automated content repurposing & distribution platform. Upload once, distribute to TikTok, YouTube, Instagram, Facebook, LinkedIn, X, and more.",
  keywords: [
    "content repurposing",
    "social media distribution",
    "cross-platform posting",
    "TikTok",
    "YouTube",
    "Instagram",
  ],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="font-sans">{children}</body>
    </html>
  );
}
