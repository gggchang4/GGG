export type ProfileProject = {
  name: string;
  description: string;
  tags: string[];
};

export const profileData = {
  name: "GGG Cheese",
  role: "Computer Science Student & Full-stack Developer",
  location: "Wuhan, China",
  university: "Wuhan University",
  headline: "Computing is my medium.",
  summary:
    "I study computer science at Wuhan University and build across the full stack. Art and sport keep me curious beyond the screen.",
  manifesto:
    "To me, computing is more than engineering. It is an artistic medium, and I hope to become an artist of it.",
  skills: [
    "Computer Science",
    "Full-stack Development",
    "Creative Coding",
  ],
  favorites: [
    {
      index: "01",
      label: "On repeat",
      value: "Kanye West / Asen",
      category: "Music",
    },
    {
      index: "02",
      label: "On the shelf",
      value: "Wang Xiaobo",
      category: "Literature",
    },
    {
      index: "03",
      label: "Beyond the screen",
      value: "Art / Sport",
      category: "Practice",
    },
  ],
  timeline: [
    {
      date: "24 Mar 2005",
      year: "2005",
      title: "Born",
      detail: "Born on March 24, 2005.",
    },
    {
      date: "2011–2017",
      year: "2011",
      title: "Primary School",
      detail: "Six years of learning, noticing, and asking why.",
    },
    {
      date: "2017–2020",
      year: "2017",
      title: "Middle School",
      detail: "A formative chapter shaped by curiosity and disciplined learning.",
    },
    {
      date: "2020–2023",
      year: "2020",
      title: "Xiangyang No. 4 High School",
      detail: "Three focused years in Xiangyang, preparing for what came next.",
    },
    {
      date: "2023–Now",
      year: "2023",
      title: "Computer Science",
      detail:
        "Studying at Wuhan University, where computation is both a technical discipline and a creative medium.",
      secondaryTitle: "Full-stack Development",
      secondaryDetail:
        "Designing and building for the web—from interface to system—since 2023.",
    },
  ],
  projects: [] as ProfileProject[],
  contact: {
    email: null as string | null,
  },
} as const;
