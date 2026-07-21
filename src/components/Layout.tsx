import { NavLink, Outlet } from "react-router-dom";

const links = [
  { to: "/", label: "Disputes", end: true },
  { to: "/dashboard", label: "Dashboard" },
  { to: "/settings", label: "Settings" },
];

export function Layout() {
  return (
    <>
      <nav className="sidebar">
        <div className="brand">
          <span className="dot" />
          ChargebackShield
        </div>
        {links.map((l) => (
          <NavLink
            key={l.to}
            to={l.to}
            end={l.end}
            className={({ isActive }) => "nav-link" + (isActive ? " active" : "")}
          >
            {l.label}
          </NavLink>
        ))}
      </nav>
      <main className="main">
        <Outlet />
      </main>
    </>
  );
}
