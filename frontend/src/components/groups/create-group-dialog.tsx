"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ApiError } from "@/lib/api";
import { useChatStore } from "@/stores/chat-store";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function CreateGroupDialog({ open, onOpenChange }: Props) {
  const createGroup = useChatStore((s) => s.createGroup);
  const friends = useChatStore((s) => s.friends);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const toggle = (id: string) =>
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) { next.delete(id); } else { next.add(id); }
      return next;
    });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    const trimmedName = name.trim();
    if (!trimmedName) { setError("Group name is required"); return; }
    if (selectedIds.size === 0) { setError("Add at least one member"); return; }

    setLoading(true);
    try {
      await createGroup({
        name: trimmedName,
        description: description.trim() || undefined,
        member_ids: [...selectedIds],
      });
      setName(""); setDescription(""); setSelectedIds(new Set());
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to create group");
    } finally {
      setLoading(false);
    }
  };

  const handleClose = (v: boolean) => {
    if (!v) { setName(""); setDescription(""); setSelectedIds(new Set()); setError(""); }
    onOpenChange(v);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create group</DialogTitle>
          <DialogDescription>Start a group conversation with your friends.</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm text-violet-300/70">Group name</label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Weekend crew"
              autoFocus
            />
          </div>

          <div>
            <label className="mb-1 block text-sm text-violet-300/70">Description (optional)</label>
            <Input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What's this group for?"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm text-violet-300/70">
              Add members ({selectedIds.size} selected)
            </label>
            <div className="max-h-48 space-y-1 overflow-y-auto rounded-xl border border-violet-800/40 bg-[#1d1533] p-2">
              {friends.length === 0 && (
                <p className="py-2 text-center text-xs text-violet-400/70">No friends to add yet.</p>
              )}
              {friends.map((f) => (
                <button
                  type="button"
                  key={f.id}
                  onClick={() => toggle(f.id)}
                  className={`flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-sm transition ${
                    selectedIds.has(f.id)
                      ? "bg-violet-600 text-white"
                      : "text-violet-200 hover:bg-[#2a1f4a]"
                  }`}
                >
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-violet-800 text-xs font-semibold">
                    {f.display_name[0].toUpperCase()}
                  </span>
                  {f.display_name}
                </button>
              ))}
            </div>
          </div>

          {error && <p className="text-sm text-red-400">{error}</p>}

          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={loading}>{loading ? "Creating…" : "Create group"}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
