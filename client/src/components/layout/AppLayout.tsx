// The frame around every page: top bar on desktop, bottom tab bar on phones (SRS IR-01, IR-02).
// To add a page to the navigation, add it to NAV_ITEMS.
import { NavLink, Outlet, useNavigate } from "react-router";
import { useAuth } from "../../auth/AuthContext";
import { Button, ButtonLink, useToast } from "../ui";

const NAV_ITEMS = [
  { to: "/", label: "Parties", icon: "🎲", end: true },
  { to: "/create", label: "Create", icon: "➕" },
  { to: "/my-parties", label: "My Parties", icon: "📅" },
  { to: "/bookmarks", label: "Bookmarks", icon: "🔖" },
  { to: "/cafes", label: "Cafes", icon: "📍" },
];

const linkClass = ({ isActive }: { isActive: boolean }) =>
  `rounded-full px-3 py-2 text-sm font-semibold transition-colors ${
    isActive
      ? "bg-brand-100 text-brand-800"
      : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
  }`;

export function AppLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();

  async function handleLogout() {
    await logout();
    toast.info("Logged out");
    navigate("/");
  }

  return (
    <div className="min-h-screen pb-24 lg:pb-0">
      <a href="#main-content" className="skip-link">
        Skip to content
      </a>
      <header className="clubhouse-header sticky top-0 z-40 border-b border-brand-100 bg-white/95 backdrop-blur">
        <div className="mx-auto flex min-h-20 max-w-7xl flex-wrap py-3 items-center gap-4 px-4">
          <NavLink
            to="/"
            className="flex items-center gap-2 font-extrabold tracking-tight text-brand-800"
          >
            <span className="brand-mark" aria-hidden="true">
              ⚄
            </span>
            <span className="text-xl">
              BlueButton
              <span className="block text-[10px] tracking-[.2em] text-brand-700">
                THE BOARD-GAME CLUBHOUSE
              </span>
            </span>
          </NavLink>

          <nav className="hidden flex-1 justify-center gap-1 lg:flex" aria-label="Main">
            {NAV_ITEMS.map((item) => (
              <NavLink key={item.to} to={item.to} end={item.end} className={linkClass}>
                {item.label}
              </NavLink>
            ))}
            {user?.role === "ADMIN" && (
              <NavLink to="/admin" className={linkClass}>
                Admin
              </NavLink>
            )}
          </nav>

          <div className="ml-auto flex items-center gap-2">
            {user ? (
              <>
                <NavLink
                  to="/profile"
                  className="text-sm font-medium text-slate-700 hover:text-brand-700"
                >
                  {user.nickname}
                </NavLink>
                <Button variant="ghost" size="sm" onClick={handleLogout}>
                  Log out
                </Button>
              </>
            ) : (
              <>
                <ButtonLink to="/login" variant="ghost" size="sm">
                  Log in
                </ButtonLink>
                <ButtonLink to="/register" size="sm">
                  Sign up
                </ButtonLink>
              </>
            )}
          </div>
        </div>
      </header>

      <main id="main-content" className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        <Outlet />
      </main>

      <footer className="mx-auto hidden max-w-7xl border-t border-brand-200 px-6 py-8 text-sm text-slate-500 lg:block">
        Good games bring people together. BlueButton · KAIST CS350 ·{" "}
        <NavLink to="/help" className="underline">
          Help &amp; FAQ
        </NavLink>
      </footer>

      {/* Bottom tab bar on phones */}
      <nav
        className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 border-t border-slate-200 bg-white pb-[env(safe-area-inset-bottom)] lg:hidden"
        aria-label="Main"
      >
        {NAV_ITEMS.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) =>
              `flex flex-col items-center gap-0.5 py-2 text-xs ${isActive ? "text-brand-700" : "text-slate-500"}`
            }
          >
            <span aria-hidden="true" className="text-lg leading-none">
              {item.icon}
            </span>
            {item.label}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
