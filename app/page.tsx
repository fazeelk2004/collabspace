import { LandingPage } from "@/components/landing/landing-page";
import { getSession } from "@/lib/auth/session";

export default async function Home() {
  const session = await getSession();
  return <LandingPage isAuthenticated={!!session} />;
}
