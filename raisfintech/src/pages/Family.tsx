import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useGuidance } from "../ux/GuidanceContext";
import { PageHeader, EmptyState, InfoTip, StatusBadge } from "../ux/components";

export function Family() {
  const { state, update } = useGuidance();
  const navigate = useNavigate();
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [relationship, setRelationship] = useState("Spouse");
  const [role, setRole] = useState("Viewer");

  const addMember = (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    const member = { id: crypto.randomUUID(), name: name.trim(), relationship, role };
    update({
      familyMembers: [...state.familyMembers, member],
      familyAdded: true,
    });
    setName("");
    setShowForm(false);
  };

  const removeMember = (id: string) => {
    const rest = state.familyMembers.filter((m) => m.id !== id);
    update({ familyMembers: rest, familyAdded: rest.length > 0 });
  };

  const form = (
    <form className="card" onSubmit={addMember}>
      <div className="card-title">Add a family member</div>
      <div className="form-grid mt-16">
        <div className="field">
          <label htmlFor="fm-name">Name</label>
          <input id="fm-name" value={name} onChange={(e) => setName(e.target.value)} required />
        </div>
        <div className="field">
          <label htmlFor="fm-rel">Relationship</label>
          <select id="fm-rel" value={relationship} onChange={(e) => setRelationship(e.target.value)}>
            {["Spouse", "Child", "Parent", "Sibling", "Other"].map((r) => (
              <option key={r}>{r}</option>
            ))}
          </select>
        </div>
      </div>
      <div className="field">
        <label>
          Role{" "}
          <InfoTip>
            Viewer can see shared information. Delegate can act on your behalf for the areas
            you allow. Emergency contact is notified when the estate workspace is activated.
          </InfoTip>
        </label>
        <select value={role} onChange={(e) => setRole(e.target.value)}>
          {["Viewer", "Delegate", "Emergency contact"].map((r) => (
            <option key={r}>{r}</option>
          ))}
        </select>
      </div>
      <div className="row">
        <button className="btn btn-primary" type="submit">Add Member</button>
        {state.familyMembers.length > 0 && (
          <button className="btn btn-ghost" type="button" onClick={() => setShowForm(false)}>
            Cancel
          </button>
        )}
      </div>
    </form>
  );

  return (
    <>
      <PageHeader
        crumbs={[{ label: "Family", to: "/family" }, { label: "Members" }]}
        eyebrow="Family"
        title="Your Family"
        description="Add the people who matter and assign their roles. Family members are the foundation of delegation and your legacy plan."
        actions={
          state.familyMembers.length > 0 ? (
            <>
              <button className="btn btn-primary" onClick={() => setShowForm(true)}>Add Member</button>
              <button className="btn btn-secondary" onClick={() => navigate("/family/legacy")}>
                Go to Legacy Plan
              </button>
            </>
          ) : undefined
        }
      />

      {state.familyMembers.length === 0 && !showForm ? (
        <EmptyState
          icon="👪"
          title="No family members yet"
          body="Your family circle starts here. Adding members unlocks Legacy planning, shared documents and delegation."
          steps={[
            "Add each family member",
            "Assign a role — viewer, delegate or emergency contact",
            "Continue to your legacy plan",
          ]}
          action={
            <button className="btn btn-primary" onClick={() => setShowForm(true)}>
              Add Your First Member
            </button>
          }
        />
      ) : (
        <>
          {showForm || state.familyMembers.length === 0 ? form : null}
          {state.familyMembers.length > 0 && (
            <div className="card">
              <div className="card-title">Members</div>
              <div className="table-wrap">
                <table className="data">
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Relationship</th>
                      <th>Role</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {state.familyMembers.map((m) => (
                      <tr key={m.id}>
                        <td><strong>{m.name}</strong></td>
                        <td>{m.relationship}</td>
                        <td><StatusBadge tone={m.role === "Delegate" ? "gold" : m.role === "Emergency contact" ? "blue" : "gray"}>{m.role}</StatusBadge></td>
                        <td style={{ textAlign: "right" }}>
                          <button className="btn btn-sm btn-ghost" onClick={() => removeMember(m.id)}>
                            Remove
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </>
  );
}
