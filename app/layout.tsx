import type { Metadata, Viewport } from "next";
import "@/styles/global.css";

export const metadata: Metadata = {
  title: {
    default: "Personal Profile Web",
    template: "%s | Personal Profile Web",
  },
  description: "A personal profile website with multiple visual style entries.",
};

export const viewport: Viewport = {
  themeColor: "#f7f7f2",
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
