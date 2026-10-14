import ProtectedRoute from "@/components/ProtectedRoute";
import DashboardSidebar from "@/components/DashboardSidebar";
import AccessGate from "@/components/AccessGate";
import LembretesSino from "@/components/LembretesSino";
import { FormDirtyProvider } from "@/lib/formDirtyContext";

export default function DashboardLayout({ children }) {
  return (
    <ProtectedRoute>
      <FormDirtyProvider>
        <div className="flex min-h-screen flex-col bg-cream-50 lg:flex-row">
          <DashboardSidebar />
          <LembretesSino />
          <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6">
            <AccessGate>{children}</AccessGate>
          </main>
        </div>
      </FormDirtyProvider>
    </ProtectedRoute>
  );
}
