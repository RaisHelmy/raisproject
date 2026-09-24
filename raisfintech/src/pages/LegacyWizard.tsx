import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useGuidance } from "../ux/GuidanceContext";
import {
  PageHeader,
  WorkflowStepper,
  EmptyState,
  SuccessState,
  InfoTip,
} from "../ux/components";

const STEPS = [
  "Family",
  "Assets",
  "Liabilities",
  "Documents",
  "Islamic Planning",
  "Review",
  "Professional Review",
];

/**
 * The legacy workflow is deliberately gentle: "prepare your family's
 * financial future", never alarming language. Progress is saved at every
 * step and can be resumed any time.
 */
export function LegacyWizard() {
  const { state, update } = useGuidance();
  const navigate = useNavigate();
  const [step, setStep] = useState(Math.max(0, state.legacyStep));
  const [started, setStarted] = useState(state.legacyStep >= 0 || state.legacyDone);

  const crumbs = [
    { label: "Family", to: "/family" },
    { label: "Legacy", to: "/family/legacy" },
    { label: "Estate Plan" },
  ];

  // Gate: family first — with a clear explanation, not a dead end.
  if (!state.familyAdded) {
    return (
      <>
        <PageHeader
          crumbs={crumbs}
          eyebrow="Family Legacy"
          title="Prepare your family's financial future"
          description="Your family should know what to do when it matters most."
        />
        <EmptyState
          icon="🕊️"
          title="Start with your family"
          body="The legacy plan is built around the people in it. Add your family members first — then we'll organize your assets, documents and roles together."
          steps={["Add your family members", "Assign roles", "Return here to begin your legacy plan"]}
          action={
            <button className="btn btn-primary" onClick={() => navigate("/family")}>
              Set Up Family
            </button>
          }
        />
      </>
    );
  }

  if (state.legacyDone) {
    return (
      <>
        <PageHeader
          crumbs={crumbs}
          eyebrow="Family Legacy"
          title="Your Legacy Plan"
          description="Complete. Review it whenever your circumstances change."
        />
        <div className="card">
          <SuccessState
            title="Your legacy plan is in place"
            body="Your assets, documents, family roles and Islamic estate planning information are organized. Your designated family members will know where to find what they need."
            nextBody="Revisit the plan after major life events — a new family member, a property purchase, or a change in obligations."
            actions={
              <>
                <button
                  className="btn btn-secondary"
                  onClick={() => {
                    update({ legacyDone: false, legacyStep: 0 });
                    setStarted(true);
                    setStep(0);
                  }}
                >
                  Review & Update Plan
                </button>
                <button className="btn btn-primary" onClick={() => navigate("/")}>
                  Back to Dashboard
                </button>
              </>
            }
          />
        </div>
      </>
    );
  }

  if (!started) {
    return (
      <>
        <PageHeader
          crumbs={crumbs}
          eyebrow="Family Legacy"
          title="Prepare your family's financial future"
          description="Your family should know what to do when it matters most."
        />
        <div className="card">
          <p>Let's organize your:</p>
          <div className="mt-16">
            {[
              "Assets",
              "Important documents",
              "Family roles",
              "Outstanding obligations",
              "Estate planning information",
              "Emergency contacts",
            ].map((item) => (
              <div className="check-row ok" key={item}>
                <span className="cr-state">✓</span> {item}
              </div>
            ))}
          </div>
          <div className="alert alert-info mt-24">
            <span aria-hidden>ⓘ</span>
            <span>
              This workspace organizes information for your family. It does not replace legal,
              Syariah, court, trustee, bank or institutional processes.
            </span>
          </div>
          <div className="wizard-actions">
            <span className="spacer" />
            <span className="save-note">Seven short steps · pause anytime, nothing is lost.</span>
            <button
              className="btn btn-gold"
              onClick={() => {
                setStarted(true);
                update({ legacyStep: 0 });
              }}
            >
              Begin Legacy Plan
            </button>
          </div>
        </div>
      </>
    );
  }

  const next = () => {
    const n = step + 1;
    if (n >= STEPS.length) {
      update({ legacyDone: true, legacyStep: -1 });
    } else {
      setStep(n);
      update({ legacyStep: n });
    }
  };

  const saveAndExit = () => {
    update({ legacyStep: step });
    navigate("/");
  };

  return (
    <>
      <PageHeader
        crumbs={crumbs}
        eyebrow="Family Legacy"
        title="Legacy Plan"
        description="Step by step, at your own pace. Everything you enter is saved as you go."
      />

      <div className="card">
        <WorkflowStepper steps={STEPS} current={step} />

        {step === 0 && (
          <>
            <p>
              These are the people in your plan. Confirm each member's role — who can view,
              who can act, who to contact first.
            </p>
            <div className="mt-16">
              {state.familyMembers.map((m) => (
                <div className="check-row ok" key={m.id}>
                  <span className="cr-state">✓</span>
                  <span>
                    <strong>{m.name}</strong> · {m.relationship} · {m.role}
                  </span>
                </div>
              ))}
            </div>
            <p className="muted mt-16">
              Need to change someone? You can <a href="/family" onClick={(e) => { e.preventDefault(); saveAndExit(); navigate("/family"); }}>edit members</a> and resume — your progress is kept.
            </p>
          </>
        )}

        {step === 1 && (
          <>
            <p>
              List what you own — property, vehicles, investments, savings, business interests.
              Connected accounts are included automatically.
            </p>
            <div className="mt-16">
              <div className="check-row ok"><span className="cr-state">✓</span> Moomoo portfolio {state.portfolioSynced ? "· RM 248,530 (synced)" : "· will sync automatically"}</div>
              <div className="check-row todo"><span className="cr-state">○</span> Property, vehicles and other assets — add these when convenient</div>
            </div>
          </>
        )}

        {step === 2 && (
          <p>
            Outstanding obligations — financing, personal debts, and amounts owed to you.
            In Islamic estate settlement, debts are settled before distribution, so a clear
            record here saves your family significant difficulty.
          </p>
        )}

        {step === 3 && (
          <>
            <p>
              Attach the documents your family would need: identification, ownership papers,
              insurance and takaful policies, and your wasiat if you have one.
            </p>
            <p className="muted mt-16">
              Files are stored securely and only accessible to the roles you assign. Manage
              them anytime under <strong>Family → Documents</strong>.
            </p>
          </>
        )}

        {step === 4 && (
          <>
            <p>
              Islamic estate planning information for your family and advisors.
            </p>
            <div className="mt-16">
              <p>
                <strong>Wasiat</strong>{" "}
                <InfoTip>
                  A wasiat expresses your wishes within the limits allowed by Syariah,
                  typically up to one third of the estate for non-heirs.
                </InfoTip>
                {" "}— record whether one exists and where it is kept.
              </p>
              <p className="mt-16">
                <strong>Hibah</strong>{" "}
                <InfoTip>
                  A voluntary transfer of ownership during the giver's lifetime, subject to
                  applicable legal and Syariah requirements.
                </InfoTip>
                {" "}— note any hibah arrangements already made.
              </p>
              <p className="mt-16">
                <strong>Faraid</strong>{" "}
                <InfoTip>
                  This calculation is an informational estimate and does not replace
                  professional Syariah or legal advice.
                </InfoTip>
                {" "}— an estimated distribution overview for your heirs.
              </p>
            </div>
          </>
        )}

        {step === 5 && (
          <>
            <p>Review what your plan covers so far:</p>
            <div className="mt-16">
              <div className="check-row ok"><span className="cr-state">✓</span> {state.familyMembers.length} family member{state.familyMembers.length === 1 ? "" : "s"} with roles</div>
              <div className="check-row ok"><span className="cr-state">✓</span> Assets recorded {state.portfolioSynced ? "(incl. synced portfolio)" : ""}</div>
              <div className="check-row ok"><span className="cr-state">✓</span> Obligations noted</div>
              <div className="check-row ok"><span className="cr-state">✓</span> Documents organized</div>
              <div className="check-row ok"><span className="cr-state">✓</span> Islamic planning information captured</div>
            </div>
          </>
        )}

        {step === 6 && (
          <>
            <p>
              <strong>Professional review.</strong> Rais Fintech organizes information; the
              legal instruments themselves — wasiat, hibah documentation, trust arrangements —
              should be prepared or reviewed by a qualified professional.
            </p>
            <div className="alert alert-info mt-16">
              <span aria-hidden>ⓘ</span>
              <span>
                Information → recommendation → your decision → professional review → external
                execution. Completing this step marks your plan ready; it does not execute any
                legal process.
              </span>
            </div>
          </>
        )}

        <div className="wizard-actions">
          {step > 0 && (
            <button className="btn btn-secondary" onClick={() => setStep(step - 1)}>
              Back
            </button>
          )}
          <span className="spacer" />
          <span className="save-note">Saved automatically.</span>
          <button className="btn btn-ghost" onClick={saveAndExit}>
            Save & continue later
          </button>
          <button className="btn btn-primary" onClick={next}>
            {step === STEPS.length - 1 ? "Complete Plan" : "Continue"}
          </button>
        </div>
      </div>
    </>
  );
}
