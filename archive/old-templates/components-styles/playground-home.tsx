import { AboutSection } from "@/components/sections/about-section";
import { ContactSection } from "@/components/sections/contact-section";
import { HeroSection } from "@/components/sections/hero-section";
import { LabSection } from "@/components/sections/lab-section";
import { StackSection } from "@/components/sections/stack-section";
import { WorksSection } from "@/components/sections/works-section";

export function PlaygroundHome() {
  return (
    <main>
      <HeroSection />
      <WorksSection />
      <LabSection />
      <AboutSection />
      <StackSection />
      <ContactSection />
    </main>
  );
}
