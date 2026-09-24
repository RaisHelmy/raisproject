import { HfHeader } from "../../app/header/HfHeader";
import { ExplorePage } from "./ExplorePage";

/**
 * "/" for everyone: the header bar plus the Explore page. Signed-in users see
 * their balance and avatar in the header; visitors see Login / Sign up. The
 * page body is the same either way, as on the reference.
 */
export function ExploreHome() {
  return (
    <>
      <HfHeader />
      <main id="main">
        <ExplorePage />
      </main>
    </>
  );
}
