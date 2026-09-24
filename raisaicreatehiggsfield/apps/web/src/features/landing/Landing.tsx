import { LandingPage } from "./LandingPage";

/** "/" is always the public showcase. Signed-in users enter the studio via /create. */
export function Landing() {
  return <LandingPage />;
}
