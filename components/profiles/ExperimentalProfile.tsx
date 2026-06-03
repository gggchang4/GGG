import { Layout } from "@/components/common/Layout";
import { Button } from "@/components/common/Button";
import { ProfileSummary } from "@/components/profiles/ProfileSummary";

export function ExperimentalProfile() {
  return (
    <Layout>
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-10 px-5 py-14 sm:px-8 lg:px-10">
        <div className="rounded-lg border border-border bg-secondary p-6">
          <p className="text-sm font-medium uppercase text-primary">Experimental profile</p>
          <h1 className="mt-4 max-w-3xl text-4xl font-semibold leading-tight text-foreground sm:text-5xl">
            The same content, ready for a bolder visual system later.
          </h1>
          <div className="mt-6">
            <Button href="/" variant="secondary">
              Back to styles
            </Button>
          </div>
        </div>

        <ProfileSummary tone="experimental" />
      </div>
    </Layout>
  );
}
