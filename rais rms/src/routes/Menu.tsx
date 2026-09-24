import { useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useOutlet } from "../lib/outlet";
import { api, ApiClientError } from "../lib/api";

interface MenuSummary {
  id: string;
  name: string;
}
interface MenuItemRow {
  id: string;
  name: string;
  description: string | null;
  price_minor: number;
  currency: string;
  available: boolean;
  image_r2_key: string | null;
}
interface MenuSectionRow {
  id: string;
  name: string;
  items: MenuItemRow[];
}
interface MenuFull extends MenuSummary {
  sections: MenuSectionRow[];
}

export function Menu() {
  const { outletId, outlets } = useOutlet();
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const [selectedMenuId, setSelectedMenuId] = useState<string | null>(null);
  const [newMenuName, setNewMenuName] = useState("");
  const [newSectionName, setNewSectionName] = useState("");
  const [itemForms, setItemForms] = useState<Record<string, { name: string; price: string }>>({});

  const currency = outlets.find((o) => o.id === outletId)?.currency ?? "USD";

  const menusQuery = useQuery({
    queryKey: ["menus", outletId],
    queryFn: () => api.get<MenuSummary[]>(`/api/outlets/${outletId}/menus`),
    enabled: !!outletId,
  });

  const activeMenuId = selectedMenuId ?? menusQuery.data?.[0]?.id ?? null;

  const fullMenuQuery = useQuery({
    queryKey: ["menu-full", outletId, activeMenuId],
    queryFn: () => api.get<MenuFull>(`/api/outlets/${outletId}/menus/${activeMenuId}/full`),
    enabled: !!outletId && !!activeMenuId,
  });

  const createMenu = useMutation({
    mutationFn: () => api.post<MenuSummary>(`/api/outlets/${outletId}/menus`, { name: newMenuName }),
    onSuccess: (menu) => {
      setNewMenuName("");
      setSelectedMenuId(menu.id);
      void queryClient.invalidateQueries({ queryKey: ["menus", outletId] });
    },
    onError: (err) => setError(err instanceof ApiClientError ? err.message : "Failed"),
  });

  const createSection = useMutation({
    mutationFn: () =>
      api.post(`/api/outlets/${outletId}/menus/${activeMenuId}/sections`, { name: newSectionName, sortOrder: 0 }),
    onSuccess: () => {
      setNewSectionName("");
      void queryClient.invalidateQueries({ queryKey: ["menu-full", outletId, activeMenuId] });
    },
    onError: (err) => setError(err instanceof ApiClientError ? err.message : "Failed"),
  });

  const createItem = useMutation({
    mutationFn: (input: { sectionId: string; name: string; priceMinor: number }) =>
      api.post(`/api/outlets/${outletId}/sections/${input.sectionId}/items`, {
        name: input.name,
        priceMinor: input.priceMinor,
        currency,
        available: true,
      }),
    onSuccess: (_data, vars) => {
      setItemForms((f) => ({ ...f, [vars.sectionId]: { name: "", price: "" } }));
      void queryClient.invalidateQueries({ queryKey: ["menu-full", outletId, activeMenuId] });
    },
    onError: (err) => setError(err instanceof ApiClientError ? err.message : "Failed"),
  });

  const toggleAvailable = useMutation({
    mutationFn: (input: { itemId: string; available: boolean }) =>
      api.patch(`/api/outlets/${outletId}/items/${input.itemId}`, { available: input.available }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["menu-full", outletId, activeMenuId] }),
  });

  if (!outletId) return <p className="text-muted">Select an outlet first.</p>;

  const menus = menusQuery.data ?? [];
  const menu = fullMenuQuery.data;

  function onCreateMenu(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (newMenuName.trim()) createMenu.mutate();
  }

  function onCreateSection(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (newSectionName.trim() && activeMenuId) createSection.mutate();
  }

  return (
    <div>
      <h1 className="h3 mb-4">Menu Management</h1>
      {error && <div className="alert alert-danger py-2">{error}</div>}

      <div className="d-flex align-items-center gap-2 mb-3">
        <select
          className="form-select form-select-sm"
          style={{ width: 240 }}
          value={activeMenuId ?? ""}
          onChange={(e) => setSelectedMenuId(e.target.value)}
        >
          {menus.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name}
            </option>
          ))}
        </select>
        <form onSubmit={onCreateMenu} className="d-flex gap-2">
          <input
            className="form-control form-control-sm"
            placeholder="New menu name"
            value={newMenuName}
            onChange={(e) => setNewMenuName(e.target.value)}
          />
          <button className="btn btn-outline-primary btn-sm" type="submit">
            Add menu
          </button>
        </form>
      </div>

      {!activeMenuId && <p className="text-muted">Create a menu to get started.</p>}

      {menu && (
        <div className="row g-3">
          {menu.sections.map((section) => (
            <div className="col-md-6" key={section.id}>
              <div className="card rais-card p-3 h-100">
                <h2 className="h6">{section.name}</h2>
                <ul className="list-group list-group-flush mb-2">
                  {section.items.map((item) => (
                    <li key={item.id} className="list-group-item px-0 d-flex justify-content-between align-items-center">
                      <div>
                        <div>{item.name}</div>
                        <small className="text-muted">
                          {(item.price_minor / 100).toFixed(2)} {item.currency}
                        </small>
                      </div>
                      <div className="form-check form-switch">
                        <input
                          className="form-check-input"
                          type="checkbox"
                          checked={item.available}
                          onChange={(e) => toggleAvailable.mutate({ itemId: item.id, available: e.target.checked })}
                        />
                      </div>
                    </li>
                  ))}
                  {section.items.length === 0 && <li className="list-group-item px-0 text-muted">No items yet.</li>}
                </ul>
                <form
                  className="d-flex gap-2"
                  onSubmit={(e) => {
                    e.preventDefault();
                    const f = itemForms[section.id] ?? { name: "", price: "" };
                    if (f.name.trim() && f.price) {
                      createItem.mutate({ sectionId: section.id, name: f.name, priceMinor: Math.round(Number(f.price) * 100) });
                    }
                  }}
                >
                  <input
                    className="form-control form-control-sm"
                    placeholder="Item name"
                    value={itemForms[section.id]?.name ?? ""}
                    onChange={(e) =>
                      setItemForms((f) => ({ ...f, [section.id]: { ...(f[section.id] ?? { price: "" }), name: e.target.value } }))
                    }
                  />
                  <input
                    className="form-control form-control-sm"
                    style={{ width: 90 }}
                    placeholder="Price"
                    type="number"
                    step="0.01"
                    value={itemForms[section.id]?.price ?? ""}
                    onChange={(e) =>
                      setItemForms((f) => ({ ...f, [section.id]: { ...(f[section.id] ?? { name: "" }), price: e.target.value } }))
                    }
                  />
                  <button className="btn btn-sm btn-primary" type="submit">
                    Add
                  </button>
                </form>
              </div>
            </div>
          ))}

          <div className="col-md-6">
            <div className="card rais-card p-3 h-100">
              <h2 className="h6">New section</h2>
              <form onSubmit={onCreateSection} className="d-flex gap-2">
                <input
                  className="form-control form-control-sm"
                  placeholder="e.g. Starters"
                  value={newSectionName}
                  onChange={(e) => setNewSectionName(e.target.value)}
                />
                <button className="btn btn-sm btn-primary" type="submit">
                  Add
                </button>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
