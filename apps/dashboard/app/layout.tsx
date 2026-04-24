import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ATMA Admin",
  description: "Admin dashboard for the Autonomous Treasury & Media Agent"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

