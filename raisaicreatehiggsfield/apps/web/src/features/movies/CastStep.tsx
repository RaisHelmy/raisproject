import { useCallback, useEffect, useState } from "react";
import { AppError } from "@raisai/shared";
import { api } from "../../lib/api";
import { AssetPicker } from "../assets/AssetPicker";
import { EmptyState } from "../../components/EmptyState";

interface Character {
  id: string;
  name: string;
  age: string | null;
  description: string | null;
  appearance: string | null;
  personality: string | null;
  voice: { modelId?: string; lang?: string };
  referenceAssetIds: string[];
}

interface Location {
  id: string;
  name: string;
  description: string | null;
  style: string | null;
  lighting: string | null;
  referenceAssetIds: string[];
}

interface VoiceModel {
  id: string;
  displayName: string;
}

/**
 * The cast and the places (§33, §34, §35).
 *
 * Appearance and reference images are the whole of character consistency: they
 * are what gets written into every shot prompt and handed to models that can
 * take an image, which is what stops a character changing face between shots.
 */
export function CastStep(props: { projectId: string }) {
  const [characters, setCharacters] = useState<Character[] | null>(null);
  const [locations, setLocations] = useState<Location[] | null>(null);
  const [voices, setVoices] = useState<VoiceModel[]>([]);
  const [editing, setEditing] = useState<Character | null>(null);
  const [editingPlace, setEditingPlace] = useState<Location | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [cast, places] = await Promise.all([
        api<{ items: Character[] }>(`/projects/${props.projectId}/characters`),
        api<{ items: Location[] }>(`/projects/${props.projectId}/locations`),
      ]);
      setCharacters(cast.items);
      setLocations(places.items);
    } catch {
      setCharacters([]);
      setLocations([]);
    }
  }, [props.projectId]);

  useEffect(() => {
    void load();
    api<{ items: VoiceModel[] }>("/models?capability=text-to-speech")
      .then((r) => setVoices(r.items))
      .catch(() => setVoices([]));
  }, [load]);

  async function addCharacter() {
    try {
      const created = await api<Character>(`/projects/${props.projectId}/characters`, {
        method: "POST",
        body: JSON.stringify({ name: "New character" }),
      });
      await load();
      setEditing(created);
    } catch (err) {
      setError(err instanceof AppError ? err.message : "That could not be added.");
    }
  }

  async function addLocation() {
    try {
      const created = await api<Location>(`/projects/${props.projectId}/locations`, {
        method: "POST",
        body: JSON.stringify({ name: "New location" }),
      });
      await load();
      setEditingPlace(created);
    } catch (err) {
      setError(err instanceof AppError ? err.message : "That could not be added.");
    }
  }

  return (
    <>
      {error && <div className="alert alert-danger" role="alert">{error}</div>}

      <div className="d-flex justify-content-between align-items-center mb-2">
        <h2 className="h6 mb-0">Characters</h2>
        <button className="btn btn-sm btn-outline-primary" type="button" onClick={addCharacter}>Add a character</button>
      </div>
      <p className="small text-secondary">
        What a character looks like, and any reference pictures, are carried into every shot they appear in.
      </p>

      {characters?.length === 0 && (
        <EmptyState icon="person" title="No characters yet." description="Write the story, or add one by hand." />
      )}

      <div className="row g-3 mb-4">
        {characters?.map((character) => (
          <div className="col-sm-6 col-lg-4" key={character.id}>
            <article className="card h-100">
              <div className="card-body">
                <div className="d-flex gap-2 mb-2">
                  {character.referenceAssetIds.slice(0, 3).map((assetId) => (
                    <img
                      key={assetId}
                      src={`/api/v1/assets/${assetId}/content`}
                      alt=""
                      className="rounded"
                      style={{ width: 44, height: 44, objectFit: "cover" }}
                    />
                  ))}
                  {character.referenceAssetIds.length === 0 && (
                    <span className="text-secondary small">No reference pictures</span>
                  )}
                </div>
                <h3 className="h6 mb-1">{character.name}{character.age && <span className="text-secondary fw-normal ms-2">{character.age}</span>}</h3>
                <p className="small text-secondary mb-2">{character.appearance || "No appearance written."}</p>
                <p className="small text-secondary mb-2">
                  {character.voice.modelId ? `Voice: ${character.voice.modelId.split("/").pop()}` : "No voice chosen"}
                </p>
                <button className="btn btn-sm btn-outline-secondary" type="button" onClick={() => setEditing(character)}>Edit</button>
              </div>
            </article>
          </div>
        ))}
      </div>

      <div className="d-flex justify-content-between align-items-center mb-2">
        <h2 className="h6 mb-0">Locations</h2>
        <button className="btn btn-sm btn-outline-primary" type="button" onClick={addLocation}>Add a location</button>
      </div>

      {locations?.length === 0 && (
        <EmptyState icon="geo-alt" title="No locations yet." description="Write the story, or add one by hand." />
      )}

      <div className="row g-3">
        {locations?.map((location) => (
          <div className="col-sm-6 col-lg-4" key={location.id}>
            <article className="card h-100">
              <div className="card-body">
                <h3 className="h6 mb-1">{location.name}</h3>
                <p className="small text-secondary mb-2">{location.lighting || "No lighting written."}</p>
                <button className="btn btn-sm btn-outline-secondary" type="button" onClick={() => setEditingPlace(location)}>Edit</button>
              </div>
            </article>
          </div>
        ))}
      </div>

      {editing && (
        <CharacterDialog
          character={editing}
          voices={voices}
          onClose={() => setEditing(null)}
          onSaved={async () => {
            setEditing(null);
            await load();
          }}
        />
      )}

      {editingPlace && (
        <LocationDialog
          location={editingPlace}
          onClose={() => setEditingPlace(null)}
          onSaved={async () => {
            setEditingPlace(null);
            await load();
          }}
        />
      )}
    </>
  );
}

function CharacterDialog(props: { character: Character; voices: VoiceModel[]; onClose: () => void; onSaved: () => void }) {
  const [draft, setDraft] = useState(props.character);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setBusy(true);
    setError(null);
    try {
      await api(`/characters/${draft.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          name: draft.name,
          age: draft.age ?? "",
          description: draft.description ?? "",
          appearance: draft.appearance ?? "",
          personality: draft.personality ?? "",
          voice: draft.voice,
          referenceAssetIds: draft.referenceAssetIds,
        }),
      });
      props.onSaved();
    } catch (err) {
      setError(err instanceof AppError ? [err.message, err.action].filter(Boolean).join(" ") : "That could not be saved.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="modal d-block" role="dialog" aria-modal="true" aria-labelledby="character-title" style={{ background: "rgba(0,0,0,.5)" }}>
      <div className="modal-dialog modal-dialog-centered modal-lg">
        <div className="modal-content">
          <div className="modal-header">
            <h2 className="modal-title h6" id="character-title">Character</h2>
            <button type="button" className="btn-close" aria-label="Close" onClick={props.onClose} />
          </div>
          <div className="modal-body">
            {error && <div className="alert alert-danger py-2 small" role="alert">{error}</div>}

            <div className="row g-3 mb-3">
              <div className="col-sm-8">
                <label className="form-label" htmlFor="ch-name">Name</label>
                <input id="ch-name" className="form-control" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
              </div>
              <div className="col-sm-4">
                <label className="form-label" htmlFor="ch-age">Age</label>
                <input id="ch-age" className="form-control" value={draft.age ?? ""} onChange={(e) => setDraft({ ...draft, age: e.target.value })} />
              </div>
            </div>

            <div className="mb-3">
              <label className="form-label" htmlFor="ch-appearance">Appearance</label>
              <textarea
                id="ch-appearance"
                className="form-control"
                rows={2}
                value={draft.appearance ?? ""}
                onChange={(e) => setDraft({ ...draft, appearance: e.target.value })}
                placeholder="Grey coat, stubble, tired eyes"
              />
              <div className="form-text">Written into every shot this character appears in.</div>
            </div>

            <div className="mb-3">
              <label className="form-label" htmlFor="ch-personality">Personality</label>
              <input id="ch-personality" className="form-control" value={draft.personality ?? ""} onChange={(e) => setDraft({ ...draft, personality: e.target.value })} />
            </div>

            <AssetPicker
              selected={draft.referenceAssetIds}
              onChange={(referenceAssetIds) => setDraft({ ...draft, referenceAssetIds })}
              max={4}
            />
            <p className="small text-secondary">
              Reference pictures are passed to models that accept them, which is what keeps a face the same between shots.
            </p>

            <div className="mb-0">
              <label className="form-label" htmlFor="ch-voice">Voice</label>
              <select
                id="ch-voice"
                className="form-select"
                value={draft.voice.modelId ?? ""}
                onChange={(e) => setDraft({ ...draft, voice: { ...draft.voice, modelId: e.target.value || undefined } })}
              >
                <option value="">No voice</option>
                {props.voices.map((voice) => <option key={voice.id} value={voice.id}>{voice.displayName}</option>)}
              </select>
              <div className="form-text">Used for every line this character speaks.</div>
            </div>
          </div>
          <div className="modal-footer">
            <button className="btn btn-outline-secondary" type="button" onClick={props.onClose}>Cancel</button>
            <button className="btn btn-primary" type="button" onClick={save} disabled={busy}>
              {busy ? "Saving…" : "Save"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function LocationDialog(props: { location: Location; onClose: () => void; onSaved: () => void }) {
  const [draft, setDraft] = useState(props.location);
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true);
    try {
      await api(`/locations/${draft.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          name: draft.name,
          description: draft.description ?? "",
          style: draft.style ?? "",
          lighting: draft.lighting ?? "",
          referenceAssetIds: draft.referenceAssetIds,
        }),
      });
      props.onSaved();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="modal d-block" role="dialog" aria-modal="true" aria-labelledby="location-title" style={{ background: "rgba(0,0,0,.5)" }}>
      <div className="modal-dialog modal-dialog-centered">
        <div className="modal-content">
          <div className="modal-header">
            <h2 className="modal-title h6" id="location-title">Location</h2>
            <button type="button" className="btn-close" aria-label="Close" onClick={props.onClose} />
          </div>
          <div className="modal-body">
            <div className="mb-3">
              <label className="form-label" htmlFor="loc-name">Name</label>
              <input id="loc-name" className="form-control" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
            </div>
            <div className="mb-3">
              <label className="form-label" htmlFor="loc-description">Description</label>
              <textarea id="loc-description" className="form-control" rows={2} value={draft.description ?? ""} onChange={(e) => setDraft({ ...draft, description: e.target.value })} />
            </div>
            <div className="mb-3">
              <label className="form-label" htmlFor="loc-lighting">Lighting</label>
              <input id="loc-lighting" className="form-control" value={draft.lighting ?? ""} onChange={(e) => setDraft({ ...draft, lighting: e.target.value })} placeholder="Hard neon, wet reflections" />
              <div className="form-text">Written into every shot set here.</div>
            </div>
            <AssetPicker
              selected={draft.referenceAssetIds}
              onChange={(referenceAssetIds) => setDraft({ ...draft, referenceAssetIds })}
              max={4}
            />
          </div>
          <div className="modal-footer">
            <button className="btn btn-outline-secondary" type="button" onClick={props.onClose}>Cancel</button>
            <button className="btn btn-primary" type="button" onClick={save} disabled={busy}>
              {busy ? "Saving…" : "Save"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
