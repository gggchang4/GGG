import { Layout } from "@/components/common/Layout";
import { Button } from "@/components/common/Button";
import { ProfileSummary } from "@/components/profiles/ProfileSummary";

export function ClassicProfile() {
  return (
    <Layout>
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-10 px-5 py-14 sm:px-8 lg:px-10">
        <div className="flex flex-col gap-5 border-b border-border pb-10">
          <p className="text-sm font-medium uppercase text-primary">Classic profile</p>
          <h1 className="max-w-3xl text-4xl font-semibold leading-tight text-foreground sm:text-5xl">
            A clean, resume-friendly profile foundation.
          </h1>
          <div>
            <Button href="/" variant="outline">
              Back to styles
            </Button>
          </div>
        </div>

        <ProfileSummary tone="classic" />
      </div>
    </Layout>
  );
}
