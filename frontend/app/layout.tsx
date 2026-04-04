import type { Metadata, Viewport } from "next";

import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://wearekidsnursery.example"),
  title: {
    default: "We Are Kids Nursery",
    template: "%s | We Are Kids Nursery",
  },
  description:
    "Nursery-school LMS and live class platform built with Next.js and FastAPI for classrooms, dashboards, recordings, and admin management.",
  applicationName: "We Are Kids Nursery",
  icons: {
    icon: "/icon.svg",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#ffffff",
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
