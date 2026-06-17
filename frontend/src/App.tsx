import { Routes, Route } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Sidebar } from "./components/layout/Sidebar";
import { Dashboard } from "./pages/Dashboard";
import { AgentControl } from "./pages/AgentControl";
import { Reports } from "./pages/Reports";
import { Inventory } from "./pages/Inventory";
import { Accounting } from "./pages/Accounting";
import { AIChat } from "./pages/AIChat";
import { Workflow } from "./pages/Workflow";
import { agentApi } from "./lib/api";

export default function App() {
  const { data: agentStatus } = useQuery({
    queryKey: ["agent-status"],
    queryFn: agentApi.getStatus,
    refetchInterval: 10000,
  });

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Sidebar agentRunning={agentStatus?.isRunning} />
      <main className="flex flex-1 flex-col overflow-hidden">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/agent" element={<AgentControl />} />
          <Route path="/reports" element={<Reports />} />
          <Route path="/reports/:id" element={<Reports />} />
          <Route path="/inventory" element={<Inventory />} />
          <Route path="/accounting" element={<Accounting />} />
          <Route path="/chat" element={<AIChat />} />
          <Route path="/workflow" element={<Workflow />} />
        </Routes>
      </main>
    </div>
  );
}
