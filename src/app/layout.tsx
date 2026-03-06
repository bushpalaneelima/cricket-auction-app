import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Game of Gambits - Professional Auction Engine",
  description: "Professional auction platform for entertainment and education by NB Blue Studios",
  icons: {
    icon: '/favicon.ico',
  },
  openGraph: {
    title: "Game of Gambits - Professional Auction Engine",
    description: "Professional auction platform for entertainment and education",
    url: "https://auction.nbbluestudios.com",
    siteName: "Game of Gambits",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "Game of Gambits by NB Blue Studios",
      },
    ],
    locale: "en_IN",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Game of Gambits - Professional Auction Engine",
    description: "Professional auction platform for entertainment and education",
    images: ["/og-image.png"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
