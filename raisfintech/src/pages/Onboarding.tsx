import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useGuidance } from "../ux/GuidanceContext";
import { useAuth } from "../AuthContext";

const STEP_LABELS = ["Profile", "Financial Accounts", "Investments", "Family", "Legacy"];

/**
 * First-time onboarding: a short, skippable 5-step flow. Skipping is always
 * allowed — but we say plainly which features stay locked until configured.
 */
export function Onboarding() {
  const navigate = useNavigate();
  const { state, update } = useGuidance();
  const { user } = useAuth();
  const [step, setStep] = useState(0); // 0 = welcome screen
  const [name, setName] = useState(state.profileName || user?.name || "");
  const [goal, setGoal] = useState(state.profileGoal);

  const finish = (profileCompleted: boolean) => {
    update({
      onboarded: true,
      profileDone: profileCompleted || state.profileDone,
      profileName: name,
      profileGoal: goal,
    });
    navigate("/");
  };

  const Dots = () => (
    <div className="ob-dots" aria-hidden>
      {STEP_LABELS.map((_, i) => (
        <i key={i} className={i + 1 <= step ? "on" : ""} />
      ))}
    </div>
  );

  const Foot = ({ next, nextLabel = "Continue", canNext = true }: { next: () => void; nextLabel?: string; canNext?: boolean }) => (
    <div className="onboard-foot">
      <span className="ob-stepnum">
        Step {step} of {STEP_LABELS.length} · {STEP_LABELS[step - 1]}
      </span>
      <div className="row">
        <Dots />
        {step > 1 && (
          <button className="btn btn-ghost btn-sm" onClick={() => setStep(step - 1)}>
            Back
          </button>
        )}
        <button className="btn btn-primary" onClick={next} disabled={!canNext}>
          {nextLabel}
        </button>
      </div>
    </div>
  );

  return (
    <div className="onboard-wrap">
      <div className="onboard-card">
        <div className="ob-brand">Rais Fintech</div>

        {step === 0 && (
          <>
            <h1 className="ob-title">
              Manage your wealth today.
              <br />
              Protect your family tomorrow.
            </h1>
            <p className="ob-sub">
              Let's configure your financial workspace. It takes about two minutes, and you
              can pause at any point without losing progress.
            </p>
            <div className="onboard-foot">
              <button className="btn btn-ghost" onClick={() => finish(false)}>
                Skip for now
              </button>
              <div className="row">
                <span className="ob-stepnum">Step 1 of 5</span>
                <button className="btn btn-gold" onClick={() => setStep(1)}>
                  Get Started
                </button>
              </div>
            </div>
            <p className="muted" style={{ marginTop: 18 }}>
              If you skip, Robo Trading, Legacy and Automation stay locked until the related
              setup is complete. You can resume anytime from <strong>System → Setup</strong>.
            </p>
          </>
        )}

        {step === 1 && (
          <>
            <h1 className="ob-title">Who are we building this for?</h1>
            <p className="ob-sub">This personalizes your dashboard and recommendations.</p>
            <div className="mt-24">
              <div className="field">
                <label htmlFor="ob-name">Your name</label>
                <input
                  id="ob-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Rais Helmy"
                />
              </div>
              <div className="field">
                <label>What matters most to you right now?</label>
                {[
                  { icon: "📈", title: "Grow my investments", desc: "Portfolio tracking, strategies and robo trading." },
                  { icon: "🕌", title: "Manage wealth the Islamic way", desc: "Zakat, Shariah screening and estate planning." },
                  { icon: "👪", title: "Protect my family's future", desc: "Family roles, documents and a legacy plan." },
                ].map((o) => (
                  <button
                    key={o.title}
                    className={`ob-option ${goal === o.title ? "selected" : ""}`}
                    onClick={() => setGoal(o.title)}
                  >
                    <span className="obo-icon" aria-hidden>{o.icon}</span>
                    <span>
                      <span className="obo-title">{o.title}</span>
                      <br />
                      <span className="obo-desc">{o.desc}</span>
                    </span>
                  </button>
                ))}
              </div>
            </div>
            <Foot next={() => setStep(2)} canNext={name.trim().length > 0 && goal !== ""} />
          </>
        )}

        {step === 2 && (
          <>
            <h1 className="ob-title">Financial accounts</h1>
            <p className="ob-sub">
              Rais Fintech connects to supported brokerages — starting with Moomoo — to
              synchronize your holdings securely. We only ever request read access unless you
              explicitly enable trading later.
            </p>
            <div className="alert alert-info mt-24">
              <span aria-hidden>🔐</span>
              <span>
                You'll connect from <strong>Connections → Moomoo</strong> after setup. Nothing
                is shared without your authorization.
              </span>
            </div>
            <Foot next={() => setStep(3)} />
          </>
        )}

        {step === 3 && (
          <>
            <h1 className="ob-title">Investments</h1>
            <p className="ob-sub">
              Once a brokerage is connected, your Portfolio shows value, performance and
              allocation in one place. Robo Trading and Strategies unlock after your first
              connection — we introduce advanced features only when they're useful to you.
            </p>
            <Foot next={() => setStep(4)} />
          </>
        )}

        {step === 4 && (
          <>
            <h1 className="ob-title">Family</h1>
            <p className="ob-sub">
              Add family members and assign roles — who can view, who can act on your behalf,
              and who to contact in an emergency. Family setup is the foundation for your
              legacy plan.
            </p>
            <Foot next={() => setStep(5)} />
          </>
        )}

        {step === 5 && (
          <>
            <h1 className="ob-title">Legacy</h1>
            <p className="ob-sub">
              Your family should know what to do when it matters most. The Legacy Plan
              organizes your assets, documents, obligations and Islamic estate planning
              information — step by step, at your own pace, with professional review at the
              end.
            </p>
            <Foot next={() => finish(true)} nextLabel="Enter Rais Fintech" />
          </>
        )}
      </div>
    </div>
  );
}
