import type { Metadata, Viewport } from "next";
import { Footer } from "@/components/layout/footer";
import { Navbar } from "@/components/layout/navbar";
import { LenisProvider } from "@/components/motion/lenis-provider";
import "./globals.css";

export const metadata: Metadata = {
  title: "Personal Digital Space",
  description:
    "A personal digital space for frontend engineering, AI exploration, and interaction design.",
};

export const viewport: Viewport = {
  themeColor: "#050505",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN" className="dark font-sans">
      <body>
        <LenisProvider>
          <Navbar />
          {children}
          <Footer />
        </LenisProvider>
      </body>
    </html>
  );
}
