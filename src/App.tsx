import { HashRouter, Route, Routes } from "react-router-dom";
import { Layout } from "@/components/Layout";
import { DisputeQueue } from "@/pages/DisputeQueue";
import { DisputeDetail } from "@/pages/DisputeDetail";
import { Dashboard } from "@/pages/Dashboard";
import { Settings } from "@/pages/Settings";

export function App() {
  return (
    <HashRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<DisputeQueue />} />
          <Route path="/disputes/:id" element={<DisputeDetail />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/settings" element={<Settings />} />
        </Route>
      </Routes>
    </HashRouter>
  );
}
