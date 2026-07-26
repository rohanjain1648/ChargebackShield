import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Sun, Moon, ShieldCheck, LayoutDashboard, FileText, Settings, ArrowLeft, LogOut } from "lucide-react";

const links = [
  { to: "/app", label: "Dispute Queue", icon: FileText, end: true },
  { to: "/app/dashboard", label: "Analytics", icon: LayoutDashboard },
  { to: "/app/settings", label: "Settings", icon: Settings },
];

export function Layout() {
  const navigate = useNavigate();
  const [authState, setAuthState] = useState<"checking" | "in" | "out">("checking");
  const [theme, setTheme] = useState(localStorage.getItem("theme") || "dark");

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("theme", theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === "dark" ? "light" : "dark"));
  };

  useEffect(() => {
    base44.auth
      .isAuthenticated()
      .then((ok) => setAuthState(ok ? "in" : "out"))
      .catch(() => setAuthState("out"));
  }, []);

  const handleLogin = () => {
    base44.auth.loginWithProvider("google", window.location.href);
  };

  const handleLogout = () => {
    base44.auth.logout("/#/app");
  };

  if (authState === "checking") {
    return (
      <div className="auth-screen">
        <p className="auth-checking">Authenticating with Base44 SDK…</p>
      </div>
    );
  }

  if (authState === "out") {
    return (
      <div className="auth-screen">
        <div className="auth-card">
          <div className="brand" style={{ fontSize: "1.2rem", fontWeight: 700 }}>
            <span className="dot" />
            ChargebackShield
          </div>
          <h2 className="auth-title">Sign in</h2>
          <p className="auth-subtitle">Log in with your merchant account to access live disputes.</p>
          <button className="auth-button" type="button" onClick={handleLogin}>
            Continue with Google
          </button>
          <button 
            type="button" 
            onClick={() => navigate("/")}
            style={{ 
              background: "none", 
              border: "1px solid var(--border)", 
              color: "var(--text-dim)", 
              padding: "8px", 
              borderRadius: "8px",
              cursor: "pointer",
              fontSize: "0.85rem",
              marginTop: "8px"
            }}
          >
            ← Back to Landing Page
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      <nav className="sidebar">
        <div className="brand" style={{ cursor: "pointer" }} onClick={() => navigate("/")}>
          <div style={{
            width: 26,
            height: 26,
            borderRadius: 8,
            background: "linear-gradient(135deg, var(--accent), var(--accent-cyan))",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "white"
          }}>
            <ShieldCheck size={16} />
          </div>
          ChargebackShield
        </div>

        <button 
          className="nav-link" 
          onClick={() => navigate("/")}
          style={{ marginBottom: 12, display: "flex", alignItems: "center", gap: 8, fontSize: "0.85rem" }}
        >
          <ArrowLeft size={16} /> Landing Page
        </button>

        {links.map((l) => {
          const Icon = l.icon;
          return (
            <NavLink
              key={l.to}
              to={l.to}
              end={l.end}
              className={({ isActive }) => "nav-link" + (isActive ? " active" : "")}
              style={{ display: "flex", alignItems: "center", gap: 10 }}
            >
              <Icon size={18} />
              {l.label}
            </NavLink>
          );
        })}
        
        <div style={{ marginTop: "auto", display: "flex", flexDirection: "column", gap: 6 }}>
          <button 
            className="nav-link" 
            onClick={toggleTheme} 
            style={{ display: "flex", alignItems: "center", gap: 10 }}
          >
            {theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
            {theme === "dark" ? "Light Mode" : "Dark Mode"}
          </button>
          
          <button 
            className="nav-link logout-link" 
            onClick={handleLogout}
            style={{ display: "flex", alignItems: "center", gap: 10, color: "var(--bad)" }}
          >
            <LogOut size={18} /> Log out
          </button>
        </div>
      </nav>
      
      <motion.main
        className="main"
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -15 }}
        transition={{ duration: 0.3 }}
      >
        <Outlet />
      </motion.main>
    </>
  );
}
