import { Link } from "react-router-dom";
import { formatMYR } from "@raisai/shared";
import { useAuth } from "../../features/auth/AuthContext";
import { useBalance } from "../../features/billing/useBalance";
import { GlobalSearch } from "../../components/GlobalSearch";
import { NavigationMenu } from "./NavigationMenu";
import { MobileMenu } from "./MobileMenu";

/**
 * The 52px black header bar: logo, the scrollable primary nav with its mega
 * menu, then the right-hand actions (Pricing, Enterprise, language, and either
 * Login / Sign up or the signed-in credit chip and avatar). Layout and class
 * names follow the reference so header.css applies unchanged.
 *
 * `balanceSen` lets the app shell share the balance it already fetched; when
 * omitted (public pages) the header fetches it itself for signed-in visitors.
 */
export function HfHeader(props: { balanceSen?: number | null }) {
  const { user } = useAuth();
  const own = useBalance(Boolean(user) && props.balanceSen === undefined);
  const balanceSen = props.balanceSen === undefined ? own.balance?.availableSen ?? null : props.balanceSen;

  return (
    <header id="header-visual">
      <div className="hf-container">
        <Link to="/" className="hf-brand" aria-label="RaisAI Create home">
          <span role="img" aria-label="RaisAI" className="hf-logo">
            <span className="hf-logo__fill" aria-hidden="true" />
            <RaisGlyph />
          </span>
          <span className="hfnav-wordmark">RaisAI</span>
        </Link>

        <NavigationMenu />

        <div className="hfnav-actions">
          <div className="hfnav-actions-group hfnav-actions-primary">
            {user && <GlobalSearch variant="icon" />}
            <Link to="/pricing" title="View RaisAI Create pricing plans" className="hfnav-action hfnav-action-pricing">
              <svg aria-hidden="true" width="24" height="24" viewBox="0 0 24 24" fill="none">
                <path d="M8.5 7.75L6.25 10L8.5 12.25M12.7071 20.0429L22.049 10.701C22.4371 10.3129 22.4398 9.68443 22.0551 9.29295L16.901 4.04903C16.713 3.85774 16.4561 3.75 16.1879 3.75H7.81214C7.54393 3.75 7.28696 3.85774 7.09895 4.04903L1.94493 9.29295C1.56016 9.68443 1.56288 10.3129 1.95102 10.701L11.2929 20.0429C11.6834 20.4334 12.3166 20.4334 12.7071 20.0429Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              Pricing
            </Link>
            <Link to="/enterprise" className="hfnav-action hfnav-desktop-only">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path stroke="currentColor" strokeLinecap="square" strokeLinejoin="round" strokeWidth="1.5" d="M12 2.75C13 8 16 11 21.25 12 16 13 13 16 12 21.25 11 16 8 13 2.75 12 8 11 11 8 12 2.75Z" />
              </svg>
              <span>Enterprise</span>
            </Link>
            <button type="button" className="hfnav-language hfnav-desktop-only" aria-label="Language: English" title="Language">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <circle cx="12" cy="12" r="9.25" stroke="currentColor" strokeWidth="1.5" />
                <path d="M2.75 12h18.5M12 2.75c2.6 2.7 3.9 5.8 3.9 9.25s-1.3 6.55-3.9 9.25c-2.6-2.7-3.9-5.8-3.9-9.25S9.4 5.45 12 2.75Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
              </svg>
            </button>
          </div>
          <span className="hfnav-actions-divider" />
          <div className="hfnav-actions-group">
            {user ? (
              <>
                <Link to="/balance" className="hfnav-action hfnav-action-credit" aria-label="Current balance">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <path d="M3.75 7.25A2.5 2.5 0 0 1 6.25 4.75h11.5a2.5 2.5 0 0 1 2.5 2.5v9.5a2.5 2.5 0 0 1-2.5 2.5H6.25a2.5 2.5 0 0 1-2.5-2.5v-9.5Z" stroke="currentColor" strokeWidth="1.5" />
                    <path d="M3.75 9.75h16.5M15.5 14.25h2.25" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                  </svg>
                  <span className="hfnav-action-label">{balanceSen === null ? "—" : formatMYR(balanceSen)}</span>
                </Link>
                <Link to="/account" className="hfnav-avatar" aria-label="Account">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <circle cx="12" cy="8" r="4" stroke="currentColor" strokeWidth="1.5" />
                    <path d="M4.5 20.25c.9-3.6 3.9-5.5 7.5-5.5s6.6 1.9 7.5 5.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                  </svg>
                </Link>
              </>
            ) : (
              <>
                <Link to="/login" className="hfnav-auth hfnav-auth-login hfnav-desktop-only">Login</Link>
                <Link to="/signup" className="hfnav-auth hfnav-auth-signup">Sign up</Link>
              </>
            )}
            <MobileMenu />
          </div>
        </div>
      </div>
    </header>
  );
}

/** Monogram: a bold R cut from the white tile, same 26px glyph box as the reference. */
function RaisGlyph() {
  return (
    <svg className="hf-logo__glyph" viewBox="0 0 20 20" fill="none" aria-hidden="true" focusable="false">
      <path
        d="M4.5 2.5h6.1c3.2 0 5.4 1.9 5.4 4.9 0 2.1-1.1 3.7-3 4.4l3.6 5.7h-3.5l-3.1-5.1H7.6v5.1H4.5V2.5Zm3.1 2.7v4.6h2.8c1.6 0 2.5-.9 2.5-2.3s-.9-2.3-2.5-2.3H7.6Z"
        fill="currentColor"
      />
    </svg>
  );
}
