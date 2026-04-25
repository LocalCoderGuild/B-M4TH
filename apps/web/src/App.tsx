import { lazy, Suspense } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { HomePage } from "./pages/HomePage";
import { InvitePage } from "./pages/InvitePage";

// Code-split MatchPage — it pulls in PixiJS + BoardScene (~450 kB minified)
// which the Home and Invite pages don't need.
const MatchPage = lazy(() => import("./pages/MatchPage").then((m) => ({ default: m.MatchPage })));

export function App() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/invite/:token" element={<InvitePage />} />
      <Route
        path="/room/:matchId"
        element={
          <Suspense
            fallback={
              <div className="puzzle-theme-root pixel-page">
                <div className="pixel-loading">
                  <span>[ Loading match… ]</span>
                </div>
              </div>
            }
          >
            <MatchPage />
          </Suspense>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
