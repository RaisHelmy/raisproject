import { useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { useMutation, useQuery } from "@tanstack/react-query";
import { api, ApiClientError } from "../../lib/api";

interface MenuItemRow {
  id: string;
  name: string;
  description: string | null;
  price_minor: number;
  currency: string;
}
interface MenuSectionRow {
  id: string;
  name: string;
  items: MenuItemRow[];
}
interface MenuFull {
  id: string;
  name: string;
  sections: MenuSectionRow[];
}

export function QrOrder() {
  const { tenantSlug, outletId, menuId } = useParams<{ tenantSlug: string; outletId: string; menuId: string }>();
  const [searchParams] = useSearchParams();
  const tableId = searchParams.get("table") ?? undefined;
  const [cart, setCart] = useState<Record<string, number>>({});
  const [error, setError] = useState<string | null>(null);
  const [placedOrderId, setPlacedOrderId] = useState<string | null>(null);

  const menuQuery = useQuery({
    queryKey: ["public-menu", tenantSlug, outletId, menuId],
    queryFn: () => api.get<MenuFull>(`/api/public/${tenantSlug}/outlets/${outletId}/menus/${menuId}`),
    enabled: !!tenantSlug && !!outletId && !!menuId,
  });

  const items = (menuQuery.data?.sections ?? []).flatMap((s) => s.items);
  const total = Object.entries(cart).reduce((sum, [itemId, qty]) => {
    const item = items.find((i) => i.id === itemId);
    return sum + (item ? item.price_minor * qty : 0);
  }, 0);
  const currency = items[0]?.currency ?? "USD";

  const placeOrder = useMutation({
    mutationFn: () =>
      api.post<{ id: string }>(`/api/public/${tenantSlug}/outlets/${outletId}/orders`, {
        type: "qr",
        tableId,
        items: Object.entries(cart)
          .filter(([, qty]) => qty > 0)
          .map(([menuItemId, qty]) => ({ menuItemId, qty })),
      }),
    onSuccess: (order) => setPlacedOrderId(order.id),
    onError: (err) => setError(err instanceof ApiClientError ? err.message : "Could not place order"),
  });

  function updateQty(itemId: string, delta: number) {
    setCart((c) => ({ ...c, [itemId]: Math.max(0, (c[itemId] ?? 0) + delta) }));
  }

  if (placedOrderId) {
    return (
      <div className="container py-5 text-center" style={{ maxWidth: 480 }}>
        <h1 className="h4">Order placed!</h1>
        <p className="text-muted">Your order is on its way to the kitchen.</p>
      </div>
    );
  }

  return (
    <div className="container py-4" style={{ maxWidth: 480 }}>
      <h1 className="h4 mb-3">{menuQuery.data?.name ?? "Menu"}</h1>
      {error && <div className="alert alert-danger py-2">{error}</div>}

      {(menuQuery.data?.sections ?? []).map((section) => (
        <div key={section.id} className="mb-4">
          <h2 className="h6">{section.name}</h2>
          {section.items.map((item) => (
            <div key={item.id} className="d-flex justify-content-between align-items-center border-bottom py-2">
              <div>
                <div>{item.name}</div>
                {item.description && <div className="text-muted small">{item.description}</div>}
                <div className="small">
                  {(item.price_minor / 100).toFixed(2)} {item.currency}
                </div>
              </div>
              <div className="d-flex align-items-center gap-2">
                <button className="btn btn-sm btn-outline-secondary" onClick={() => updateQty(item.id, -1)}>
                  −
                </button>
                <span>{cart[item.id] ?? 0}</span>
                <button className="btn btn-sm btn-outline-secondary" onClick={() => updateQty(item.id, 1)}>
                  +
                </button>
              </div>
            </div>
          ))}
        </div>
      ))}

      <div className="position-sticky bottom-0 bg-white border-top pt-3 pb-2">
        <div className="d-flex justify-content-between mb-2">
          <strong>Total</strong>
          <strong>
            {(total / 100).toFixed(2)} {currency}
          </strong>
        </div>
        <button className="btn btn-primary w-100" disabled={total === 0 || placeOrder.isPending} onClick={() => placeOrder.mutate()}>
          {placeOrder.isPending ? "Placing…" : "Place order"}
        </button>
      </div>
    </div>
  );
}
