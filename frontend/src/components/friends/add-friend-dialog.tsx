"use client";

import { useState } from "react";
import { UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ApiError, type User } from "@/lib/api";
import { useChatStore } from "@/stores/chat-store";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function AddFriendDialog({ open, onOpenChange }: Props) {
  const searchUsers = useChatStore((s) => s.searchUsers);
  const sendFriendRequest = useChatStore((s) => s.sendFriendRequest);
  const friends = useChatStore((s) => s.friends);

  const [query, setQuery] = useState("");
  const [results, setResults] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const friendIds = new Set(friends.map((f) => f.id));

  const handleSearch = async () => {
    if (query.trim().length < 2) return;
    setLoading(true);
    setError("");
    setSearched(false);
    try {
      const users = await searchUsers(query.trim());
      setResults(users);
      setSearched(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Search failed");
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = async (user: User) => {
    setError("");
    setMessage("");
    try {
      await sendFriendRequest(user.id);
      setMessage(`Friend request sent to ${user.display_name}`);
      setResults((prev) => prev.filter((u) => u.id !== user.id));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not send request");
    }
  };

  const handleOpenChange = (next: boolean) => {
    if (!next) {
      setQuery("");
      setResults([]);
      setSearched(false);
      setMessage("");
      setError("");
    }
    onOpenChange(next);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add friend</DialogTitle>
          <DialogDescription>Search by username, display name, or email.</DialogDescription>
        </DialogHeader>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSearch();
          }}
          className="flex gap-2"
        >
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search users…"
          />
          <Button type="submit" disabled={loading || query.trim().length < 2}>
            Search
          </Button>
        </form>

        {message && <p className="text-sm text-emerald-400">{message}</p>}
        {error && <p className="text-sm text-red-400">{error}</p>}

        {searched && results.length === 0 && !loading && (
          <p className="text-sm text-zinc-500">No users found. Try a different username, display name, or email.</p>
        )}

        <ul className="max-h-60 space-y-2 overflow-y-auto">
          {results.map((user) => (
            <li
              key={user.id}
              className="flex items-center justify-between rounded-lg border border-zinc-800 px-3 py-2"
            >
              <div>
                <p className="text-sm font-medium text-zinc-100">{user.display_name}</p>
                <p className="text-xs text-zinc-500">@{user.username}</p>
              </div>
              {friendIds.has(user.id) ? (
                <span className="text-xs text-zinc-500">Friends</span>
              ) : (
                <Button size="sm" variant="secondary" onClick={() => handleAdd(user)}>
                  <UserPlus className="mr-1 h-3 w-3" />
                  Add
                </Button>
              )}
            </li>
          ))}
        </ul>
      </DialogContent>
    </Dialog>
  );
}
