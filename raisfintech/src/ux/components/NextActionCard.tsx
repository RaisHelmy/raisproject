import { useNavigate } from "react-router-dom";
import { useGuidance } from "../GuidanceContext";
import { nextAction } from "../guidance";

/**
 * The dashboard's contextual "what should I do next?" card. Reads the
 * journey state and surfaces exactly one recommendation.
 */
export function NextActionCard() {
  const { state } = useGuidance();
  const navigate = useNavigate();
  const action = nextAction(state);

  if (!action) {
    return (
      <div className="next-action">
        <div className="na-icon" aria-hidden>
          ✅
        </div>
        <div>
          <div className="na-kicker">You're all set</div>
          <div className="na-title">Your workspace is fully configured</div>
          <p className="na-body">
            Keep your portfolio synchronized and review your legacy plan whenever your
            circumstances change.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="next-action">
      <div className="na-icon" aria-hidden>
        {action.icon}
      </div>
      <div>
        <div className="na-kicker">Recommended next step</div>
        <div className="na-title">{action.title}</div>
        <p className="na-body">{action.body}</p>
        <div className="na-cta">
          <button className="btn btn-primary" onClick={() => navigate(action.route)}>
            {action.cta}
          </button>
        </div>
      </div>
    </div>
  );
}
