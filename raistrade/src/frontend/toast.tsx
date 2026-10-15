import { useEffect, useState } from "react";

type Toast = { id: number; ok: boolean; text: string };
let push: (t: Omit<Toast, "id">) => void = () => {};

export const toast = {
  ok: (text: string) => push({ ok: true, text }),
  err: (text: string) => push({ ok: false, text }),
};

export function Toaster() {
  const [items, setItems] = useState<Toast[]>([]);
  useEffect(() => {
    push = (t) => {
      const id = Date.now() + Math.random();
      setItems((xs) => [...xs.slice(-3), { ...t, id }]);
      setTimeout(() => setItems((xs) => xs.filter((x) => x.id !== id)), 4000);
    };
  }, []);
  return (
    <div className="toaster">
      {items.map((t) => (
        <div key={t.id} className={`toast-item ${t.ok ? "ok" : "err"}`}>{t.ok ? "✓" : "!"} {t.text}</div>
      ))}
    </div>
  );
}
