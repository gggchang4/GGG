import type { Metadata } from "next";
import { PlaygroundHome } from "@/components/styles/playground-home";
import { ReservedStylePage } from "@/components/styles/reserved-style-page";

export const metadata: Metadata = {
  title: "Style Experience | Personal Digital Space",
  description: "A style-specific entrance into the personal profile site.",
};

type StylePageProps = {
  params: Promise<{
    style: string;
  }>;
};

export default async function StylePage({ params }: StylePageProps) {
  const { style } = await params;

  if (style === "playground") {
    return <PlaygroundHome />;
  }

  return <ReservedStylePage styleSlug={style} />;
}
