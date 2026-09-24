import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Table, Badge, Button, Spinner } from "react-bootstrap";
import { api, type Ticket } from "../api";

const STATUS_VARIANT: Record<Ticket["status"], string> = {
  new: "secondary",
  open: "primary",
  pending: "warning",
  on_hold: "dark",
  resolved: "success",
  closed: "light",
};

export function TicketList() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [cursor, setCursor] = useState<string | undefined>(undefined);
  const [hasMore, setHasMore] = useState(true);

  const load = async (nextCursor?: string) => {
    setLoading(true);
    const qs = nextCursor ? `?cursor=${encodeURIComponent(nextCursor)}` : "";
    const { tickets: page } = await api.get<{ tickets: Ticket[] }>(`/api/tickets${qs}`);
    setTickets((prev) => (nextCursor ? [...prev, ...page] : page));
    setHasMore(page.length === 25);
    setCursor(page.at(-1)?.id);
    setLoading(false);
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-3">
        <h4 className="mb-0">Tickets</h4>
        <Link to="/tickets/new" className="btn btn-primary btn-sm">New ticket</Link>
      </div>
      <Table hover responsive>
        <thead>
          <tr>
            <th>#</th>
            <th>Subject</th>
            <th>Status</th>
            <th>Priority</th>
            <th>Updated</th>
          </tr>
        </thead>
        <tbody>
          {tickets.map((t) => (
            <tr key={t.id}>
              <td>
                <Link to={`/tickets/${t.id}`}>#{t.number}</Link>
              </td>
              <td>
                <Link to={`/tickets/${t.id}`}>{t.subject}</Link>
              </td>
              <td><Badge bg={STATUS_VARIANT[t.status]}>{t.status}</Badge></td>
              <td>{t.priority}</td>
              <td>{new Date(t.updatedAt).toLocaleString()}</td>
            </tr>
          ))}
          {tickets.length === 0 && !loading && (
            <tr>
              <td colSpan={5} className="text-center text-muted py-4">No tickets yet.</td>
            </tr>
          )}
        </tbody>
      </Table>
      {loading && <div className="text-center py-3"><Spinner animation="border" size="sm" /></div>}
      {!loading && hasMore && tickets.length > 0 && (
        <div className="text-center">
          <Button variant="outline-secondary" size="sm" onClick={() => load(cursor)}>Load more</Button>
        </div>
      )}
    </div>
  );
}
