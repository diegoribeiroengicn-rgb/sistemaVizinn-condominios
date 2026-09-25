import AdminGuard from "@/components/AdminGuard";
import AdminSidebar from "@/components/AdminSidebar";
import { ValoresVisiveisProvider } from "@/hooks/useValoresVisiveis";

export default function AdminLayout({ children }) {
  return (
    <AdminGuard>
      <ValoresVisiveisProvider>
        <div className="flex min-h-screen bg-cream-50">
          <AdminSidebar />
          <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6">{children}</main>
        </div>
      </ValoresVisiveisProvider>
    </AdminGuard>
  );
}
