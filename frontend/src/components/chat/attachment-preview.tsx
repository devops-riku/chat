"use client";

import { useRef, useState } from "react";
import { Download, FileText, Pause, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { Attachment } from "@/lib/api";

type Props = {
  attachment: Attachment;
  isOwn?: boolean;
};

function fmt(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function AudioPlayer({ url, filename }: { url: string; filename: string }) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);

  const toggle = () => {
    const el = audioRef.current;
    if (!el) return;
    if (playing) {
      el.pause();
    } else {
      void el.play();
    }
    setPlaying(!playing);
  };

  const fmt2 = (s: number) =>
    isNaN(s) ? "0:00" : `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

  return (
    <div className="flex items-center gap-2 rounded-lg bg-zinc-700/50 px-3 py-2">
      <audio
        ref={audioRef}
        src={url}
        onTimeUpdate={(e) => setProgress(e.currentTarget.currentTime)}
        onDurationChange={(e) => setDuration(e.currentTarget.duration)}
        onEnded={() => setPlaying(false)}
      />
      <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={toggle}>
        {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
      </Button>
      <div className="flex flex-1 flex-col gap-1">
        <p className="truncate text-xs text-zinc-300">{filename}</p>
        <div className="relative h-1 w-full rounded-full bg-zinc-600">
          <div
            className="h-full rounded-full bg-indigo-400 transition-all"
            style={{ width: duration ? `${(progress / duration) * 100}%` : "0%" }}
          />
        </div>
        <p className="text-xs text-zinc-500">
          {fmt2(progress)} / {fmt2(duration)}
        </p>
      </div>
    </div>
  );
}

export function AttachmentPreview({ attachment, isOwn }: Props) {
  const { filename, content_type, size, url } = attachment;
  const isImage = content_type.startsWith("image/");
  const isAudio = content_type.startsWith("audio/");

  if (isImage) {
    return (
      <a href={url} target="_blank" rel="noopener noreferrer">
        <img
          src={url}
          alt={filename}
          className={cn("max-h-64 max-w-xs rounded-lg object-cover", isOwn && "ml-auto")}
        />
      </a>
    );
  }

  if (isAudio) {
    return <AudioPlayer url={url} filename={filename} />;
  }

  return (
    <div className="flex items-center gap-2 rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2">
      <FileText className="h-5 w-5 shrink-0 text-zinc-400" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm text-zinc-200">{filename}</p>
        <p className="text-xs text-zinc-500">{fmt(size)}</p>
      </div>
      <a href={url} download={filename} target="_blank" rel="noopener noreferrer">
        <Button variant="ghost" size="icon" className="h-7 w-7">
          <Download className="h-4 w-4" />
        </Button>
      </a>
    </div>
  );
}
