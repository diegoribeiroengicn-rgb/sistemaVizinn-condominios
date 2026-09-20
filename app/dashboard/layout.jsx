import ProtectedRoute from "@/components/ProtectedRoute";
import DashboardHeader from "@/components/DashboardHeader";
import AccessGate from "@/components/AccessGate";

export default function DashboardLayout({ children }) {
  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-cream-50">
        <DashboardHeader />
        <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
          <AccessGate>{children}</AccessGate>
        </main>
      </div>
    </ProtectedRoute>
  );
}
