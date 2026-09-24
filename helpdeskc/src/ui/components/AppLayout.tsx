import { Outlet, Link, useNavigate } from "react-router-dom";
import { Navbar, Nav, NavDropdown, Container, Button } from "react-bootstrap";
import { useAuth } from "../auth-context";
import { api } from "../api";

export function AppLayout() {
  const { session, clear } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await api.post("/api/auth/logout");
    clear();
    navigate(session?.subjectType === "contact" ? "/portal/login" : "/login");
  };

  return (
    <>
      <Navbar bg="primary" variant="dark" expand="md" className="mb-4">
        <Container>
          <Navbar.Brand as={Link} to="/tickets">HelpdeskC</Navbar.Brand>
          <Nav className="me-auto">
            <Nav.Link as={Link} to="/tickets">Tickets</Nav.Link>
            <Nav.Link as={Link} to="/tickets/new">New ticket</Nav.Link>
            {session?.subjectType === "agent" && (
              <NavDropdown title="Admin" id="admin-nav-dropdown">
                <NavDropdown.Item as={Link} to="/admin/accounts">Accounts</NavDropdown.Item>
                <NavDropdown.Item as={Link} to="/admin/agents">Agents</NavDropdown.Item>
                <NavDropdown.Item as={Link} to="/admin/roles">Roles</NavDropdown.Item>
                <NavDropdown.Item as={Link} to="/admin/templates">Templates</NavDropdown.Item>
              </NavDropdown>
            )}
          </Nav>
          <Navbar.Text className="text-light me-3">{session?.name}</Navbar.Text>
          <Button variant="outline-light" size="sm" onClick={handleLogout}>Log out</Button>
        </Container>
      </Navbar>
      <Container>
        <Outlet />
      </Container>
    </>
  );
}
