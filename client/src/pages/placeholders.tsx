// Pages that are planned but not built yet. When you build one, move it to its own file
// in this folder and update the import in App.tsx.
import { Link } from "react-router";
import { ComingSoon, EmptyState } from "../components/ui";

export const BookmarksPage = () => (
  <ComingSoon title="Bookmarks" owner="C" requirements="FR-74 to FR-79" />
);
export const CafesPage = () => (
  <ComingSoon title="Board game cafes" owner="B" requirements="FR-123 to FR-129" />
);
export const ProfilePage = () => (
  <ComingSoon title="My profile" owner="A" requirements="FR-07, FR-08, FR-10" />
);
export const HelpPage = () => (
  <ComingSoon title="Help & FAQ" owner="D" requirements="FR-147 to FR-149" />
);

export function NotFoundPage() {
  return (
    <EmptyState
      title="Page not found"
      action={
        <Link to="/" className="text-brand-700 hover:underline">
          Go to the party list
        </Link>
      }
    >
      The page you are looking for does not exist.
    </EmptyState>
  );
}
