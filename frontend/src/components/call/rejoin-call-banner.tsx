"use client";

import { useEffect, useState } from "react";
import { Phone, X } from "lucide-react";
import { Button } from "@/components/ui/button";

const REJOIN_KEY = "call_rejoin";

type RejoinData = {
  remoteUserId: string;
  remoteDisplayName: string;
};

type Props = {
  onRejoin: (userId: string, displayName: string) => void;
};

export function RejoinCallBanner({ onRejoin }: Props) {
  const [data, setData] = useState<RejoinData | null>(null);

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(REJOIN_KEY);
      if (raw) setData(JSON.parse(raw));
    } catch {
      sessionStorage.removeItem(REJOIN_KEY);
    }
  }, []);

  if (!data) return null;

  const dismiss = () => {
    sessionStorage.removeItem(REJOIN_KEY);
    setData(null);
  };

  const rejoin = () => {
    dismiss();
    onRejoin(data.remoteUserId, data.remoteDisplayName);
  };

  return (
    <div className="fixed bottom-6 left-1/2 z-50 flex -translate-x-1/2 items-center gap-3 rounded-2xl bg-[#1d1533] px-4 py-3 shadow-lg shadow-violet-950/50 ring-1 ring-violet-800/40">
      <Phone className="h-4 w-4 shrink-0 text-emerald-400" />
      <span className="text-sm text-violet-200">
        Reconnect to call with{" "}
        <span className="font-semibold text-violet-50">{data.remoteDisplayName}</span>?
      </span>
      <Button size="sm" className="bg-emerald-600 hover:bg-emerald-500" onClick={rejoin}>
        Rejoin
      </Button>
      <Button size="icon" variant="ghost" className="h-7 w-7 shrink-0" onClick={dismiss}>
        <X className="h-4 w-4" />
      </Button>
    </div>
  );
}
