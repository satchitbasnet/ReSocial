"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { UpgradeModal } from "@/components/ui/upgrade-modal";
import { Users, Loader2, Trash2, Copy, Check } from "lucide-react";
import Link from "next/link";

interface Member {
  id: string;
  email: string;
  role: string;
  status: string;
  memberName: string | null;
  invitedAt: string;
  joinedAt: string | null;
}

export default function TeamPage() {
  const [allowed, setAllowed] = useState(false);
  const [members, setMembers] = useState<Member[]>([]);
  const [plan, setPlan] = useState("trial");
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("editor");
  const [inviteUrl, setInviteUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [upgradeOpen, setUpgradeOpen] = useState(false);

  useEffect(() => {
    fetch("/api/team")
      .then((r) => r.json())
      .then((d) => {
        setAllowed(d.allowed);
        setMembers(d.members ?? []);
        setPlan(d.plan ?? "trial");
        setLoading(false);
      });
  }, []);

  async function invite() {
    const res = await fetch("/api/team/invite", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, role }),
    });
    const data = await res.json();
    if (!res.ok) {
      if (data.upgradeRequired) setUpgradeOpen(true);
      return;
    }
    setInviteUrl(data.inviteUrl);
    setEmail("");
    const list = await fetch("/api/team").then((r) => r.json());
    setMembers(list.members ?? []);
  }

  async function removeMember(id: string) {
    await fetch(`/api/team/${id}`, { method: "DELETE" });
    setMembers((m) => m.filter((x) => x.id !== id));
  }

  async function changeRole(id: string, newRole: string) {
    await fetch(`/api/team/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role: newRole }),
    });
    setMembers((m) =>
      m.map((x) => (x.id === id ? { ...x, role: newRole } : x))
    );
  }

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="animate-spin text-brand-500" size={32} />
      </div>
    );
  }

  if (!allowed) {
    return (
      <div className="max-w-lg mx-auto text-center py-16">
        <Users size={48} className="mx-auto text-gray-300 mb-4" />
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Team Collaboration</h1>
        <p className="text-gray-600 mb-6">
          Invite editors and viewers, manage roles, and approve posts before they go live.
          Available on the Agency plan.
        </p>
        <Button href="/pricing">Upgrade to Agency</Button>
      </div>
    );
  }

  return (
    <div className="max-w-3xl">
      <h1 className="text-2xl font-bold text-gray-900 mb-2">Team</h1>
      <p className="text-gray-600 text-sm mb-8">
        Invite team members and assign roles. Editors need admin approval before publishing.
      </p>

      <div className="glass-card p-5 mb-6">
        <p className="text-sm font-medium text-gray-700 mb-3">Invite Member</p>
        <div className="flex flex-col sm:flex-row gap-3">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="teammate@company.com"
            className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 text-sm"
          />
          <select
            value={role}
            onChange={(e) => setRole(e.target.value)}
            className="text-sm rounded-xl border border-gray-200 px-3 py-2.5"
          >
            <option value="admin">Admin</option>
            <option value="editor">Editor</option>
            <option value="viewer">Viewer</option>
          </select>
          <Button onClick={invite}>Send Invite</Button>
        </div>
        {inviteUrl && (
          <div className="mt-3 flex items-center gap-2 text-sm bg-brand-50 rounded-xl p-3">
            <span className="truncate flex-1 text-brand-800">{inviteUrl}</span>
            <button
              onClick={() => {
                navigator.clipboard.writeText(inviteUrl);
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
              }}
              className="text-brand-600 shrink-0"
            >
              {copied ? <Check size={16} /> : <Copy size={16} />}
            </button>
          </div>
        )}
      </div>

      <div className="glass-card divide-y divide-gray-50">
        {members.length === 0 ? (
          <p className="text-center text-gray-500 text-sm py-12">No Team Members Yet.</p>
        ) : (
          members.map((m) => (
            <div key={m.id} className="p-4 flex items-center gap-4">
              <div className="flex-1 min-w-0">
                <p className="font-medium text-gray-900 truncate">{m.email}</p>
                <p className="text-xs text-gray-500 capitalize">
                  {m.status}
                  {m.memberName ? ` · ${m.memberName}` : ""}
                </p>
              </div>
              <select
                value={m.role}
                onChange={(e) => changeRole(m.id, e.target.value)}
                className="text-sm rounded-lg border border-gray-200 px-2 py-1"
              >
                <option value="admin">Admin</option>
                <option value="editor">Editor</option>
                <option value="viewer">Viewer</option>
              </select>
              <button
                onClick={() => removeMember(m.id)}
                className="text-gray-400 hover:text-red-500"
              >
                <Trash2 size={16} />
              </button>
            </div>
          ))
        )}
      </div>

      <p className="text-xs text-gray-400 mt-4">
        <Link href="/dashboard/settings" className="text-brand-600 hover:underline">
          Account settings
        </Link>{" "}
        · Roles: Admin (full access), Editor (create/schedule, needs approval), Viewer (read-only)
      </p>

      <UpgradeModal open={upgradeOpen} onClose={() => setUpgradeOpen(false)} limit="platforms" currentPlan={plan} />
    </div>
  );
}
