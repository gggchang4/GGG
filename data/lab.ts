export const labExperiments = [
  {
    title: "3D Card Tilt",
    type: "Motion",
    description:
      "A tactile hover surface for showcasing project previews with depth, cursor response, and subtle perspective.",
    stack: ["Motion", "CSS Transform", "Pointer"],
  },
  {
    title: "WebGL Particle Field",
    type: "WebGL",
    description:
      "A particle system direction for the home hero and future AI / Agent visual identity experiments.",
    stack: ["Three.js", "R3F", "Shader"],
  },
  {
    title: "AI Agent UI Prototype",
    type: "Agent UI",
    description:
      "A product interface study for task planning, tool calls, and making AI agent workflows legible to humans.",
    stack: ["React", "State", "UX"],
  },
  {
    title: "Scroll Narrative",
    type: "GSAP",
    description:
      "A scroll-driven case study layout with timed text reveals, visual transitions, and chapter-based storytelling.",
    stack: ["GSAP", "Lenis", "Timeline"],
  },
] as const;
