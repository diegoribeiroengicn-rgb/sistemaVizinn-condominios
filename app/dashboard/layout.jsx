import ProtectedRoute from "@/components/ProtectedRoute";
import DashboardSidebar from "@/components/DashboardSidebar";
import AccessGate from "@/components/AccessGate";
import { FormDirtyProvider } from "@/lib/formDirtyContext";

export default function DashboardLayout({ children }) {
  return (
    <ProtectedRoute>
      <FormDirtyProvider>
        <div className="flex min-h-screen bg-cream-50">
          <DashboardSidebar />
          <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6">
            <AccessGate>{children}</AccessGate>
          </main>
        </div>
      </FormDirtyProvider>
    </ProtectedRoute>
  );
}
