import { Footer } from "@/components/layout/footer";
import { Navbar } from "@/components/layout/navbar";

type StyleLayoutProps = {
  children: React.ReactNode;
  params: Promise<{
    style: string;
  }>;
};

export default async function StyleLayout({ children, params }: StyleLayoutProps) {
  const { style } = await params;

  return (
    <>
      <Navbar styleSlug={style} />
      {children}
      <Footer />
    </>
  );
}
