import type { Metadata, Viewport } from "next";
import { Providers } from "./providers";
import { ServiceWorkerRegistration } from "@/components/ServiceWorkerRegistration";
import "./globals.css";

export const metadata: Metadata = {
  title: "Shri Anandam Kitchen",
  description: "Kitchen order queue",
  appleWebApp: { capable: true, statusBarStyle: "default", title: "SA Kitchen" },
};

export const viewport: Viewport = {
  themeColor: "#b3541e",
  // A kitchen tablet is mounted/propped, tapped in a hurry — an
  // accidental pinch-zoom mid-service is a worse failure mode than
  // losing zoom entirely (same reasoning as globals.css's touch-action).
  userScalable: false,
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full bg-background text-text">
        <ServiceWorkerRegistration />
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
