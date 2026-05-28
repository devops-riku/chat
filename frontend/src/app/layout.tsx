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
  title: "Chat",
  description: "Realtime communication — chat, presence, and video calls",
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <head>
        <script dangerouslySetInnerHTML={{ __html: `
          window.addEventListener('error', function(e) {
            var msg = e.message || '';
            if (
              e.filename && e.filename.includes('/_next/') ||
              msg.includes('Loading chunk') ||
              msg.includes('Failed to fetch dynamically imported module') ||
              msg.includes('Importing a module script failed')
            ) { window.location.reload(); }
          });
          window.addEventListener('unhandledrejection', function(e) {
            var msg = String(e.reason && e.reason.message || e.reason || '');
            if (
              msg.includes('Loading chunk') ||
              msg.includes('Failed to fetch dynamically imported module') ||
              msg.includes('Importing a module script failed')
            ) { window.location.reload(); }
          });
        ` }} />
      </head>
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        {children}
      </body>
    </html>
  );
}
