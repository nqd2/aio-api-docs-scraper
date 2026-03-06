import { Dashboard } from "./_components/dashboard";
import { PlexusBackground } from "./_components/plexus-background";
import { Analytics } from "@vercel/analytics/next"

export default function Home() {
  return (
    <div className="min-h-dvh bg-background">
      <div className="pointer-events-none fixed inset-0 -z-10">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(37,99,235,0.12),transparent_55%)] dark:bg-[radial-gradient(circle_at_top,rgba(96,165,250,0.12),transparent_55%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_bottom,rgba(16,185,129,0.08),transparent_55%)]" />
      </div>
      <PlexusBackground points={70} connectDistance={160} opacity={0.55} />

      <Dashboard />
      <Analytics />
    </div>
  );
}
