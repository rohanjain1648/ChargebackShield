import { HashRouter, Route, Routes, useLocation } from "react-router-dom";
import { Layout } from "@/components/Layout";
import { DisputeQueue } from "@/pages/DisputeQueue";
import { DisputeDetail } from "@/pages/DisputeDetail";
import { Dashboard } from "@/pages/Dashboard";
import { Settings } from "@/pages/Settings";
import { Landing } from "@/pages/Landing";
import { AnimatePresence } from "framer-motion";

function AnimatedRoutes() {
  const location = useLocation();
  
  return (
    <AnimatePresence mode="wait">
      <Routes location={location} key={location.pathname}>
        <Route path="/" element={<Landing />} />
        <Route path="/app" element={<Layout />}>
          <Route index element={<DisputeQueue />} />
          <Route path="disputes/:id" element={<DisputeDetail />} />
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="settings" element={<Settings />} />
        </Route>
      </Routes>
    </AnimatePresence>
  );
}

export function App() {
  return (
    <HashRouter>
      <AnimatedRoutes />
    </HashRouter>
  );
}
