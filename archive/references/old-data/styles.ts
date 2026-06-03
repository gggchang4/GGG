export type StyleStatus = "available" | "reserved";

export type SiteStyle = {
  slug: string;
  name: string;
  tagline: string;
  description: string;
  accent: string;
  status: StyleStatus;
  preview: {
    mode: string;
    surface: string;
    rhythm: string;
    notes: string[];
  };
};

export const siteStyles = [
  {
    slug: "playground",
    name: "Playground",
    tagline: "Experimental frontend lab",
    description:
      "A kinetic, WebGL-tinted version focused on interaction experiments, motion systems, and AI-native interface energy.",
    accent: "#d7ff69",
    status: "available",
    preview: {
      mode: "WebGL / Motion / Agent UI",
      surface: "dark grid, neon geometry, pointer-responsive interfaces",
      rhythm: "fast, tactile, technical",
      notes: ["3D hero", "Lab-first structure", "Magnetic controls"],
    },
  },
  {
    slug: "neo-lab",
    name: "Neo Lab",
    tagline: "Clean AI systems showroom",
    description:
      "A restrained technical gallery for AI systems, agent workflows, and precise engineering signals.",
    accent: "#66e3ff",
    status: "reserved",
    preview: {
      mode: "AI / Systems / Glass",
      surface: "glass layers, thin borders, status rails",
      rhythm: "calm, modular, product-minded",
      notes: ["Agent panels", "System maps", "Cool light"],
    },
  },
  {
    slug: "editorial",
    name: "Editorial",
    tagline: "Typographic portfolio issue",
    description:
      "A magazine-like version built around large type, asymmetry, generous whitespace, and visual case studies.",
    accent: "#f5f5f0",
    status: "reserved",
    preview: {
      mode: "Typography / Case Study / Image",
      surface: "oversized type, editorial columns, quiet image rhythm",
      rhythm: "slow, designed, spacious",
      notes: ["Big type", "Project essays", "Archive flow"],
    },
  },
  {
    slug: "agent-os",
    name: "Agent OS",
    tagline: "Operating system for personal work",
    description:
      "A dashboard-like version that frames the portfolio as an agent cockpit with tasks, tools, traces, and outcomes.",
    accent: "#a78bfa",
    status: "reserved",
    preview: {
      mode: "Dashboard / Agent / Workflow",
      surface: "panels, command surfaces, activity streams",
      rhythm: "dense, operational, inspectable",
      notes: ["Tool calls", "Task queue", "Timeline"],
    },
  },
  {
    slug: "minimal-index",
    name: "Minimal Index",
    tagline: "Quiet archive of work and taste",
    description:
      "A bare, high-contrast index version with almost no ornament, built for speed, reading, and clarity.",
    accent: "#fffb9a",
    status: "reserved",
    preview: {
      mode: "Index / Archive / Text",
      surface: "monochrome list systems, sparse dividers, direct navigation",
      rhythm: "quiet, exact, readable",
      notes: ["Text index", "Fast scan", "Low motion"],
    },
  },
] as const satisfies readonly SiteStyle[];

export function getSiteStyle(slug: string) {
  return siteStyles.find((style) => style.slug === slug);
}

export const availableStyle = siteStyles.find((style) => style.status === "available")!;
