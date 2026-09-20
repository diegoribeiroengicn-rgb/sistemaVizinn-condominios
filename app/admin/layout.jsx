import AdminGuard from "@/components/AdminGuard";
import AdminHeader from "@/components/AdminHeader";

export default function AdminLayout({ children }) {
  return (
    <AdminGuard>
      <div className="min-h-screen bg-cream-50">
        <AdminHeader />
        <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">{children}</main>
      </div>
    </AdminGuard>
  );
}
