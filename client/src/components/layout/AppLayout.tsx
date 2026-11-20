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
  `rounded-lg px-3 py-2 text-sm font-medium ${
    isActive
      ? "bg-brand-50 text-brand-700"
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
    <div className="min-h-screen pb-20 sm:pb-0">
      <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-5xl items-center gap-4 px-4">
          <NavLink to="/" className="flex items-center gap-2 font-bold text-brand-700">
            <img src="/favicon.svg" alt="" className="size-7" />
            <span>B&amp;B</span>
            <span className="hidden font-normal text-slate-400 sm:inline">BlueButton</span>
          </NavLink>

          <nav className="hidden flex-1 gap-1 sm:flex" aria-label="Main">
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

      <main className="mx-auto max-w-5xl px-4 py-6">
        <Outlet />
      </main>

      <footer className="mx-auto hidden max-w-5xl px-4 py-8 text-xs text-slate-400 sm:block">
        B&amp;B (BlueButton) · KAIST CS350 ·{" "}
        <NavLink to="/help" className="underline">
          Help &amp; FAQ
        </NavLink>
      </footer>

      {/* Bottom tab bar on phones */}
      <nav
        className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 border-t border-slate-200 bg-white sm:hidden"
        aria-label="Main"
      >
        {NAV_ITEMS.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) =>
              `flex flex-col items-center gap-0.5 py-2 text-[11px] ${isActive ? "text-brand-700" : "text-slate-500"}`
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
