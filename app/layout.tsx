import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Camp Crawler | Yosemite availability",
  description: "Find Yosemite campground availability windows without making a reservation.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
