// Admin console. OWNER: A  (SRS FR-11 to FR-16, FR-136 to FR-146)
// TODO (A): suspend/ban users, hide parties, reports queue, settings, statistics.
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { api } from "../api/client";
import { Badge, Card, ErrorBox, Input, LoadingBlock, PageHeader } from "../components/ui";

type AdminUser = {
  id: string;
  email: string;
  nickname: string;
  role: string;
  status: string;
  createdAt: string;
};

export function AdminPage() {
  const [q, setQ] = useState("");
  const stats = useQuery({
    queryKey: ["admin", "stats"],
    queryFn: () => api<{ users: number; parties: number; activeParties: number }>("/admin/stats"),
  });
  const users = useQuery({
    queryKey: ["admin", "users", q],
    queryFn: () =>
      api<{ users: AdminUser[] }>(`/admin/users?q=${encodeURIComponent(q)}`).then((r) => r.users),
  });

  return (
    <div>
      <PageHeader title="Admin" subtitle="Only visible to admins." />

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <Stat label="Users" value={stats.data?.users} />
        <Stat label="Parties created" value={stats.data?.parties} />
        <Stat label="Active parties" value={stats.data?.activeParties} />
      </div>

      <Card>
        <div className="mb-4 flex items-center justify-between gap-4">
          <h2 className="font-semibold">Users</h2>
          <div className="w-64">
            <Input
              placeholder="Search name or email"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              aria-label="Search users"
            />
          </div>
        </div>
        {users.isPending ? (
          <LoadingBlock />
        ) : users.error ? (
          <ErrorBox error={users.error} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-200 text-xs uppercase text-slate-500">
                <tr>
                  <th className="py-2 pr-4">Nickname</th>
                  <th className="py-2 pr-4">Email</th>
                  <th className="py-2 pr-4">Role</th>
                  <th className="py-2 pr-4">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {users.data.map((u) => (
                  <tr key={u.id}>
                    <td className="py-2 pr-4 font-medium">{u.nickname}</td>
                    <td className="py-2 pr-4 text-slate-600">{u.email}</td>
                    <td className="py-2 pr-4">
                      <Badge tone={u.role === "ADMIN" ? "blue" : "gray"}>{u.role}</Badge>
                    </td>
                    <td className="py-2 pr-4">
                      <Badge tone={u.status === "ACTIVE" ? "green" : "red"}>{u.status}</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}

function Stat({ label, value }: { label: string; value?: number }) {
  return (
    <Card>
      <p className="text-sm text-slate-500">{label}</p>
      <p className="mt-1 text-3xl font-bold">{value ?? "–"}</p>
    </Card>
  );
}
