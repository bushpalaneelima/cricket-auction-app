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
  title: "Cricket Auction Hub",
  description: "Live cricket player auction platform for fantasy cricket league",
  icons: {
    icon: '/favicon.ico',
  },
  openGraph: {
    title: "Cricket Auction Hub",
    description: "Live cricket player auction platform for fantasy cricket league",
    url: "https://auction.nbbluestudios.com",
    siteName: "Cricket Auction Hub",
    images: [
      {
        url: "/og-image.png", // You'll need to add this image
        width: 1200,
        height: 630,
        alt: "Cricket Auction Hub",
      },
    ],
    locale: "en_IN",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Cricket Auction Hub",
    description: "Live cricket player auction platform for fantasy cricket league",
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