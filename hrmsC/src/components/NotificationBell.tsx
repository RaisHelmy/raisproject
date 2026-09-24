import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api/client";
import type { Notification } from "../types";

export function NotificationBell() {
  const navigate = useNavigate();
  const [count, setCount] = useState(0);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  function loadCount() {
    api.get<{ count: number }>("/notifications/unread-count").then((res) => setCount(res.count));
  }

  useEffect(() => {
    loadCount();
    const interval = setInterval(loadCount, 30_000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  async function toggleOpen() {
    if (!open) {
      const res = await api.get<{ notifications: Notification[] }>("/notifications");
      setNotifications(res.notifications);
    }
    setOpen((o) => !o);
  }

  async function handleClick(n: Notification) {
    if (!n.is_read) {
      await api.post(`/notifications/${n.id}/read`);
      loadCount();
      setNotifications((prev) => prev.map((x) => (x.id === n.id ? { ...x, is_read: 1 } : x)));
    }
    setOpen(false);
    if (n.link) navigate(n.link);
  }

  async function markAllRead() {
    await api.post("/notifications/read-all");
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: 1 })));
    setCount(0);
  }

  return (
    <div className="position-relative" ref={ref}>
      <button className="btn btn-outline-secondary btn-sm position-relative" onClick={toggleOpen}>
        <i className="bi bi-bell" />
        {count > 0 && (
          <span className="position-absolute top-0 start-100 translate-middle badge rounded-pill bg-danger" style={{ fontSize: "0.6rem" }}>
            {count > 9 ? "9+" : count}
          </span>
        )}
      </button>
      {open && (
        <div
          className="position-absolute end-0 mt-2 bg-white border rounded shadow-sm"
          style={{ width: 340, maxHeight: 420, overflowY: "auto", zIndex: 1050 }}
        >
          <div className="d-flex justify-content-between align-items-center px-3 py-2 border-bottom">
            <strong className="small">Notifications</strong>
            {count > 0 && (
              <button className="btn btn-link btn-sm p-0" onClick={markAllRead}>
                Mark all read
              </button>
            )}
          </div>
          <ul className="list-group list-group-flush">
            {notifications.map((n) => (
              <li
                key={n.id}
                className={`list-group-item small ${n.is_read ? "" : "bg-light"}`}
                style={{ cursor: "pointer" }}
                onClick={() => handleClick(n)}
              >
                <div>{n.message}</div>
                <div className="text-secondary" style={{ fontSize: "0.75rem" }}>
                  {new Date(n.created_at).toLocaleString()}
                </div>
              </li>
            ))}
            {notifications.length === 0 && <li className="list-group-item small text-secondary">No notifications yet.</li>}
          </ul>
        </div>
      )}
    </div>
  );
}
