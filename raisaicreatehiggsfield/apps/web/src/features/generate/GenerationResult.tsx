import { Link } from "react-router-dom";
import { FinalCost } from "../../components/CostEstimate";
import { GenerationActions } from "./GenerationActions";
import { assetUrl, isAssetHandle, type AssetHandleDTO, type GenerationDTO } from "../../lib/types";

/** Shows what came back plus what it cost, and what the user can do next (§74). */
export function GenerationResult(props: {
  generation: GenerationDTO;
  balanceAfterSen: number | null;
  onRegenerate: () => void;
  onUseAsInput?: (asset: AssetHandleDTO) => void;
}) {
  const { generation } = props;

  if (generation.status === "failed") {
    return (
      <div className="alert alert-danger" role="alert">
        <h2 className="h6">Generation failed</h2>
        <p className="mb-2">{generation.error?.message ?? "The model did not return a result."}</p>
        <div className="d-flex gap-2">
          <button className="btn btn-sm btn-danger" type="button" onClick={props.onRegenerate}>Try again</button>
          <Link className="btn btn-sm btn-outline-secondary" to="/history">See history</Link>
        </div>
        <p className="small mb-0 mt-2">You were not charged for this attempt.</p>
      </div>
    );
  }

  return (
    <div className="card">
      <div className="card-body">
        <h2 className="h6 mb-3">Result</h2>
        <div className="mb-3">{renderOutputs(generation)}</div>
        <FinalCost chargedSen={generation.chargedSen} balanceAfterSen={props.balanceAfterSen} estimated={generation.costEstimated} />
        <GenerationActions
          generation={generation}
          onRegenerate={props.onRegenerate}
          onUseAsInput={props.onUseAsInput}
        />
        <p className="small mt-2 mb-0">
          <Link to="/history">See all results</Link>
        </p>
      </div>
    </div>
  );
}

function renderOutputs(generation: GenerationDTO) {
  const entries = Object.entries(generation.outputs);
  if (entries.length === 0) return <p className="text-secondary mb-0">No output.</p>;

  return entries.map(([port, value]) => {
    if (isAssetHandle(value)) {
      const url = assetUrl(value);
      if (value.mime.startsWith("image/")) {
        return <img key={port} src={url} alt={generation.prompt || "Generated image"} className="img-fluid rounded" />;
      }
      if (value.mime.startsWith("video/")) {
        return <video key={port} src={url} controls className="w-100 rounded">
          <track kind="captions" />
        </video>;
      }
      if (value.mime.startsWith("audio/")) {
        return <audio key={port} src={url} controls className="w-100">
          <track kind="captions" />
        </audio>;
      }
      return <a key={port} href={url}>Download {port}</a>;
    }
    if (typeof value === "string") {
      return <p key={port} className="mb-0" style={{ whiteSpace: "pre-wrap" }}>{value}</p>;
    }
    return <pre key={port} className="small mb-0">{JSON.stringify(value, null, 2)}</pre>;
  });
}
