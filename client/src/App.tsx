// All pages (routes) of the app. To add a page: create it in src/pages/ and add a <Route> here.
// Wrap it in <RequireAuth> if only logged-in users may see it.
import { Route, Routes } from "react-router";
import { RequireAuth } from "./auth/AuthContext";
import { AppLayout } from "./components/layout/AppLayout";
import { AdminPage } from "./pages/AdminPage";
import { ChatPage } from "./pages/ChatPage";
import { CreatePartyPage } from "./pages/CreatePartyPage";
import { LoginPage } from "./pages/LoginPage";
import { MyPartiesPage } from "./pages/MyPartiesPage";
import { PartyDetailPage } from "./pages/PartyDetailPage";
import { PartyListPage } from "./pages/PartyListPage";
import {
  BookmarksPage,
  CafesPage,
  HelpPage,
  NotFoundPage,
  ProfilePage,
} from "./pages/placeholders";
import { RegisterPage } from "./pages/RegisterPage";

export function App() {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        {/* Guests can see these (SRS FR-09) */}
        <Route index element={<PartyListPage />} />
        <Route path="parties/:id" element={<PartyDetailPage />} />
        <Route path="login" element={<LoginPage />} />
        <Route path="register" element={<RegisterPage />} />
        <Route path="cafes" element={<CafesPage />} />
        <Route path="help" element={<HelpPage />} />

        {/* Logged-in users only */}
        <Route
          path="create"
          element={
            <RequireAuth>
              <CreatePartyPage />
            </RequireAuth>
          }
        />
        <Route
          path="parties/:id/chat"
          element={
            <RequireAuth>
              <ChatPage />
            </RequireAuth>
          }
        />
        <Route
          path="my-parties"
          element={
            <RequireAuth>
              <MyPartiesPage />
            </RequireAuth>
          }
        />
        <Route
          path="bookmarks"
          element={
            <RequireAuth>
              <BookmarksPage />
            </RequireAuth>
          }
        />
        <Route
          path="profile"
          element={
            <RequireAuth>
              <ProfilePage />
            </RequireAuth>
          }
        />

        {/* Admins only */}
        <Route
          path="admin"
          element={
            <RequireAuth admin>
              <AdminPage />
            </RequireAuth>
          }
        />

        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}
