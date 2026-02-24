import { Routes, Route, Navigate } from "react-router-dom";
import { useAuthStore } from "@store/authStore";

// Layouts
import MainLayout from "@components/layout/MainLayout";

// Pages (lazy loaded)
import { lazy, Suspense } from "react";

const HomePage = lazy(() => import("@/pages/HomePage"));
const LoginPage = lazy(() => import("@/pages/LoginPage"));
const RegisterPage = lazy(() => import("@/pages/RegisterPage"));
const GaragePage = lazy(() => import("@/pages/GaragePage"));
const AlgorithmEditorPage = lazy(() => import("@/pages/AlgorithmEditorPage"));
const BattleLobbyPage = lazy(() => import("@/pages/BattleLobbyPage"));
const BattleArenaPage = lazy(() => import("@/pages/BattleArenaPage"));
const LeaderboardPage = lazy(() => import("@/pages/LeaderboardPage"));
const ProfilePage = lazy(() => import("@/pages/ProfilePage"));
const EconomyPage = lazy(() => import("@/pages/EconomyPage"));
const ReplayPage = lazy(() => import("@/pages/ReplayPage"));

function RequireAuth({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  return isAuthenticated ? <>{children}</> : <Navigate to="/login" replace />;
}

function LoadingFallback() {
  return (
    <div className="flex h-screen items-center justify-center bg-rw-bg">
      <div className="font-pixel text-volt-DEFAULT animate-pulse text-sm">
        LOADING...
      </div>
    </div>
  );
}

export default function App() {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <Routes>
        {/* Public */}
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />

        {/* Protected */}
        <Route element={<MainLayout />}>
          <Route path="/" element={<RequireAuth><HomePage /></RequireAuth>} />
          <Route path="/garage" element={<RequireAuth><GaragePage /></RequireAuth>} />
          <Route path="/algorithms" element={<RequireAuth><AlgorithmEditorPage /></RequireAuth>} />
          <Route path="/algorithms/:id" element={<RequireAuth><AlgorithmEditorPage /></RequireAuth>} />
          <Route path="/battle" element={<RequireAuth><BattleLobbyPage /></RequireAuth>} />
          <Route path="/battle/:id" element={<RequireAuth><BattleArenaPage /></RequireAuth>} />
          <Route path="/replay/:id" element={<RequireAuth><ReplayPage /></RequireAuth>} />
          <Route path="/leaderboard" element={<LeaderboardPage />} />
          <Route path="/profile" element={<RequireAuth><ProfilePage /></RequireAuth>} />
          <Route path="/profile/:userId" element={<ProfilePage />} />
          <Route path="/economy" element={<RequireAuth><EconomyPage /></RequireAuth>} />
        </Route>

        {/* 404 */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}
