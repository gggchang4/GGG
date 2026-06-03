import { Mail } from "lucide-react";
import { profileData } from "@/data/profileData";

type ProfileSummaryProps = {
  tone?: "classic" | "experimental";
};

export function ProfileSummary({ tone = "classic" }: ProfileSummaryProps) {
  const projectClass =
    tone === "experimental"
      ? "rounded-lg border border-border bg-card p-5 shadow-sm"
      : "border-b border-border pb-5";

  return (
    <div className="grid gap-12">
      <section className="grid gap-8 lg:grid-cols-[0.85fr_1.15fr] lg:items-start">
        <div>
          <p className="text-sm text-muted-foreground">{profileData.role}</p>
          <h2 className="mt-3 text-4xl font-semibold leading-tight text-foreground">
            {profileData.name}
          </h2>
        </div>
        <p className="text-base leading-7 text-muted-foreground">{profileData.summary}</p>
      </section>

      <section className="grid gap-4">
        <h3 className="text-xl font-semibold text-foreground">Skills</h3>
        <div className="flex flex-wrap gap-2">
          {profileData.skills.map((skill) => (
            <span
              key={skill}
              className="rounded-md border border-border bg-card px-3 py-1.5 text-sm text-muted-foreground"
            >
              {skill}
            </span>
          ))}
        </div>
      </section>

      <section className="grid gap-4">
        <h3 className="text-xl font-semibold text-foreground">Projects</h3>
        <div className="grid gap-5">
          {profileData.projects.map((project) => (
            <article key={project.name} className={projectClass}>
              <h4 className="text-lg font-semibold text-foreground">{project.name}</h4>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">{project.description}</p>
              <div className="mt-4 flex flex-wrap gap-2">
                {project.tags.map((tag) => (
                  <span key={tag} className="text-xs font-medium uppercase text-primary">
                    {tag}
                  </span>
                ))}
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="rounded-lg border border-border bg-card p-5">
        <h3 className="text-xl font-semibold text-foreground">Contact</h3>
        <a
          href={`mailto:${profileData.contact.email}`}
          className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-primary"
        >
          <Mail aria-hidden className="size-4" />
          {profileData.contact.email}
        </a>
      </section>
    </div>
  );
}
