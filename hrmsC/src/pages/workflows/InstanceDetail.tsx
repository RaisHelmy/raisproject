import { useParams } from "react-router-dom";
import { RoutingTrail } from "../../components/RoutingTrail";

export function InstanceDetail() {
  const { id } = useParams<{ id: string }>();
  if (!id) return null;
  return (
    <div>
      <h1 className="h3 mb-4">Routing Trail</h1>
      <div className="card shadow-sm" style={{ maxWidth: 640 }}>
        <div className="card-body p-4">
          <RoutingTrail instanceId={id} />
        </div>
      </div>
    </div>
  );
}
