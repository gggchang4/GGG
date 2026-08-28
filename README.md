# GGG Profile

> **Computing is my medium.**

An interactive personal profile and digital playground by **GGG Cheese**, also known as **Akihisa**.

## About Me

Hi, I am GGG Cheese. I am a Computer Science student at **Wuhan University (WHU)** in Wuhan, China, and a full-stack developer interested in creative coding, interaction design, and expressive web experiences.

I see computing as more than an engineering discipline: it is also a medium for making ideas tangible. Beyond code, art, music, literature, and sport continue to shape how I think and create.

## About This Project

**GGG Profile** is the source code for my personal profile website. Instead of presenting a single conventional résumé, the site works as a profile index: visitors can explore the same identity through several distinct visual languages.

The project also turns personal interests into interactive experiences. A tactile vinyl player and a digital player-card archive sit alongside the profile pages, making the site feel closer to a small personal exhibition than a standard portfolio template.

## Experiences

| Route | Experience |
| --- | --- |
| `/` | An interactive glass-lens homepage with water, spatial motion, and a hidden corner navigation system. |
| `/profile/minimal` | A quiet, editorial profile built around glass, whitespace, and restrained typography. |
| `/profile/avant-garde` | An evolving profile direction for experimentation, motion, and art direction. |
| `/profile/ascii` | A chromatic, generative profile rendered through ASCII, canvas, and playable typography. |
| `/music` | A tactile vinyl collection with animated records, a working tonearm, and CC0 preview tracks. |
| `/cards` | An interactive archive of NBA and football player cards with prismatic optical effects. |

## Highlights

- Interactive 3D glass lens with pointer, touch, and keyboard input.
- Multiple profile systems sharing one source of personal data.
- Custom trackball physics, inertia, and spring-based reset behavior.
- Responsive layouts with keyboard navigation and reduced-motion support.
- Persistent audio playback across routes.
- Carefully art-directed CSS, WebGL, canvas, and typography experiments.

## Tech Stack

| Area | Technology |
| --- | --- |
| Framework | Next.js 16 App Router, React 19 |
| Language | TypeScript 6 |
| 3D and creative graphics | Three.js, React Three Fiber, Canvas |
| Motion | GSAP |
| Styling | CSS Modules, Tailwind CSS 4 |
| Tooling | ESLint, npm, Turbopack |

## Getting Started

### Prerequisites

- Node.js 20.9 or later
- npm

### Installation

```bash
git clone https://github.com/gggchang4/GGG.git
cd GGG
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### Useful Commands

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start the local development server. |
| `npm run build` | Create a production build. |
| `npm run start` | Run the production server. |
| `npm run lint` | Run ESLint across the project. |
| `npm run typecheck` | Run TypeScript without emitting files. |

## Project Structure

```text
app/                  App Router pages and route metadata
components/home/      Homepage lens, navigation, and corner experiences
components/profiles/  Alternative visual profile systems
components/music/     Playback state, vinyl collection, and turntable UI
components/cards/     Player-card archive and optical effects
data/                 Shared profile content and collection catalogs
lib/                  Interaction physics and shared utilities
public/media/         Record artwork, cards, and audio studies
```

Personal facts are centralized in `data/profileData.ts`, while profile directions are registered in `data/stylesConfig.ts`. This keeps identity and presentation separate, allowing each profile to interpret the same content without duplicating it.

## Media Note

The audio previews in this project are public-domain / CC0 tracks from [FreePD](https://en.freepd.cn/music). They are used for the interactive record-player study and are not recordings from the commercial albums represented by the sleeve artwork.

## Personal Project

This repository is a personal profile and creative-coding playground, not a general-purpose portfolio template. You are welcome to explore the implementation, but please do not present the personal content or media collection as your own.

## Connect

- GitHub: [@gggchang4](https://github.com/gggchang4)

Designed and built by **GGG Cheese / Akihisa**.
