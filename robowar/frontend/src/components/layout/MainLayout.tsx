import { Outlet } from "react-router-dom";

export default function MainLayout() {
  return (
    <div className="min-h-screen bg-rw-bg">
      {/* TODO: Add Navbar, Sidebar */}
      <main className="container mx-auto">
        <Outlet />
      </main>
    </div>
  );
}
