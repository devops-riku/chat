"use client";

import { useEffect, useRef, useState } from "react";
import { Mic, Paperclip, Send, Smile, X } from "lucide-react";
import { AudioRecorder } from "@/components/chat/audio-recorder";
import { Button } from "@/components/ui/button";
import { uploadFile, type Attachment } from "@/lib/api";
import { getSocket } from "@/lib/socket";
import { useChatStore } from "@/stores/chat-store";

// ─── Emoji data (Unicode 15.x / 16.x) ────────────────────────────────────────
const EMOJI_CATEGORIES = [
  {
    label: "😊 Smileys",
    emojis: ["😀","😃","😄","😁","😆","😅","🤣","😂","🙂","🙃","🫠","😉","😊","😇","🥰","😍","🤩","😘","😗","☺️","😚","😙","🥲","😋","😛","😜","🤪","😝","🤑","🤗","🫡","🤭","🫢","🫣","🤫","🤔","🫤","🤐","🤨","😐","😑","😶","🫥","😶‍🌫️","😏","😒","🙄","😬","😮‍💨","🤥","🫨","😌","😔","😪","🤤","😴","😷","🤒","🤕","🤢","🤮","🤧","🥵","🥶","🥴","😵","😵‍💫","🤯","🤠","🥳","🥸","😎","🤓","🧐","😕","🫤","😟","🙁","☹️","😮","😯","😲","😳","🥺","🥹","😦","😧","😨","😰","😥","😢","😭","😱","😖","😣","😞","😓","😩","😫","🥱","😤","😡","😠","🤬","😈","👿","💀","☠️","💩","🤡","👹","👺","👻","👽","👾","🤖"],
  },
  {
    label: "👋 Gestures",
    emojis: ["👋","🤚","🖐️","✋","🖖","🫱","🫲","🫳","🫴","🫷","🫸","👌","🤌","🤏","✌️","🤞","🫰","🤟","🤘","🤙","👈","👉","👆","🖕","👇","☝️","🫵","👍","👎","✊","👊","🤛","🤜","👏","🙌","🫶","👐","🤲","🤝","🙏","✍️","💅","🤳","💪","🦾","🦿","🦵","🦶","👂","🦻","👃","🫀","🫁","🧠","🦷","🦴","👀","👁️","👅","👄","🫦","🫂"],
  },
  {
    label: "❤️ Hearts",
    emojis: ["❤️","🩷","🧡","💛","💚","💙","🩵","💜","🖤","🩶","🤍","🤎","❤️‍🔥","❤️‍🩹","💔","❣️","💕","💞","💓","💗","💖","💘","💝","💟","☮️","✝️","☯️","🕊️","✨","💫","⭐","🌟","💥","🔥","🌈","🌊","💯","♾️"],
  },
  {
    label: "🐶 Animals",
    emojis: ["🐶","🐱","🐭","🐹","🐰","🦊","🐻","🐼","🐻‍❄️","🐨","🐯","🦁","🐮","🐷","🐸","🐵","🙈","🙉","🙊","🐔","🐧","🐦","🐦‍⬛","🦆","🦅","🦉","🦇","🐺","🦄","🐗","🦋","🐌","🐛","🐝","🪱","🐞","🐜","🪲","🪳","🦟","🦗","🕷️","🦂","🐢","🐍","🦎","🦕","🦖","🦈","🐬","🦭","🐋","🐳","🐟","🐠","🐡","🦐","🦞","🦀","🦑","🐙","🦪","🐊","🐆","🐅","🦓","🦍","🦧","🦣","🐘","🦛","🦏","🐪","🐫","🦒","🦘","🦬","🐃","🐂","🐄","🐎","🐖","🐏","🐑","🦙","🐐","🦌","🐕","🐩","🦮","🐈","🪶","🐓","🦃","🦤","🦚","🦜","🦢","🪿","🕊️","🦩","🦝","🦨","🦡","🦫","🦦","🦥","🐿️","🦔"],
  },
  {
    label: "🍔 Food",
    emojis: ["🍎","🍊","🍋","🍋‍🟩","🍇","🍓","🫐","🍒","🥭","🍍","🥥","🥝","🍅","🥑","🫒","🌽","🥕","🧄","🧅","🌶️","🫑","🥦","🥬","🥒","🍆","🧇","🥐","🍞","🥖","🥨","🧀","🥚","🍳","🧈","🥞","🧆","🥓","🍔","🍟","🌭","🍕","🌮","🌯","🫔","🥙","🧆","🥗","🥘","🫕","🍲","🍜","🍝","🍛","🍣","🍱","🥟","🦪","🍤","🍙","🍚","🍘","🍥","🥮","🍢","🧁","🍰","🎂","🍮","🍭","🍬","🍫","🍿","🍩","🍪","🌰","🥜","🫘","🍯","🧃","🥤","🧋","☕","🍵","🫖","🍺","🍻","🥂","🍷","🫗","🥃","🍸","🍹","🧉","🍾","🫚","🫛"],
  },
  {
    label: "⚽ Activities",
    emojis: ["⚽","🏀","🏈","⚾","🥎","🎾","🏐","🏉","🥏","🎱","🪀","🏓","🏸","🥊","🥋","🎯","⛳","🪁","🎣","🤿","🎽","🎿","🛷","🥌","🎮","🕹️","🎲","♟️","🎭","🎨","🖼️","🎬","🎤","🎧","🎼","🎵","🎶","🎷","🪗","🎺","🎸","🪕","🎻","🥁","🪘","🪇","🪈","🎙️","📻","🎚","🎛","🏆","🥇","🥈","🥉","🏅","🎖","🎗","🎟","🎫","🎪","🎠","🎡","🎢","🎉","🎊","🎈","🧨","🎁","🎀","🎗"],
  },
  {
    label: "🚗 Travel",
    emojis: ["🚗","🚕","🚙","🚌","🚎","🏎","🚓","🚑","🚒","🛻","🚚","🚛","🚜","🏍","🛵","🚲","🛴","🛹","🛼","🚏","🛣","🛤","⛽","🚨","🚥","🚦","🛑","🚧","⚓","🛟","⛵","🚤","🛥","🛳","🚢","✈️","🛩","🛫","🛬","🪂","💺","🚁","🚟","🚠","🚡","🛸","🚀","🛶","🚂","🚃","🚄","🚅","🚆","🚇","🚈","🚉","🚊","🚞","🚝","🗺","🧭","🌐","🗾","🏔","⛰","🌋","🗻","🏕","🏖","🏜","🏝","🏞","🏟","🏛","🏗","🧱","🏘","🏚","🏠","🏡","🏢","🏣","🏤","🏥","🏦","🏨","🏩","🏪","🏫","🏬","🏭","🏯","🏰","💒","🗼","🗽","⛪","🕌","🕍","⛩","🕋","⛲","⛺","🌁","🌃","🌄","🌅","🌆","🌇","🌉","🌌","🌠","🎑","🏙","🌄"],
  },
  {
    label: "💡 Objects",
    emojis: ["💡","🔦","🕯","🪔","📱","💻","🖥","🖨","⌨","🖱","🗜","💾","💿","📀","🧮","📷","📸","📹","🎥","📽","🎞","📞","☎️","📟","📠","📺","📻","🧭","⏱","⏲","⏰","🕰","⌚","⏳","📡","🔋","🪫","🔌","💡","🔦","🕯","🪣","🧲","🪜","🧰","🪛","🔧","🔩","⚙","🪤","🔒","🔓","🔑","🗝","🔨","🪓","⛏","⚒","🛠","🗡","⚔","🛡","🪚","🔫","🪃","🏹","🛠","🪤","🪬","💊","🩺","🩻","🩹","🩼","🩺","🔬","🔭","⚗","🧪","🧫","🧬","🔮","🧿","🪄","💎","🪩","🎎","🎐","🎑","🧧","🎀","🪆","🧸","🪅","🎭","🖼","🎨","🧵","🪡","🧶","🪢","📿","💍","👑","🎩","🪖","👒","🎓","⛑","📿","👜","👝","🎒","🧳","👓","🕶","🥽","🌂","☂"],
  },
  {
    label: "🌿 Nature",
    emojis: ["🌸","🌺","🌻","🌹","🥀","🌷","🌼","💐","🌾","🍀","🍁","🍂","🍃","🌿","☘","🪴","🎋","🎍","🪸","🌱","🌲","🌳","🌴","🪵","🪨","🌵","🎄","🌾","🍄","🍄‍🟫","🪺","🪹","🌰","🐚","🪸","🌊","🌬","🌀","🌈","🌂","☔","⚡","❄","🔥","💧","🌊","🌡","☀️","🌤","⛅","🌥","☁","🌦","🌧","⛈","🌩","🌨","🌪","🌫","🌬","🌈","🌂","⛱","⚡","❄","🌊","🌙","🌛","🌜","🌚","🌕","🌖","🌗","🌘","🌑","🌒","🌓","🌔","🌝","🌞","🪐","⭐","🌟","💫","✨","☄","🌌","🌠","🎇","🎆","🌇","🌆","🏙","🌃","🌉","🌌","🌁"],
  },
];

// ─── Emoji Picker ─────────────────────────────────────────────────────────────
function EmojiPicker({ onSelect, onClose }: { onSelect: (e: string) => void; onClose: () => void }) {
  const [activeCategory, setActiveCategory] = useState(0);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [onClose]);

  return (
    <div
      ref={ref}
      className="absolute bottom-full right-0 mb-2 flex w-[320px] flex-col overflow-hidden rounded-2xl border border-white/[0.06] bg-[#1a1d35] shadow-sm shadow-black/70"
    >
      {/* Category tabs */}
      <div className="flex overflow-x-auto border-b border-white/[0.05] px-2 pt-2 pb-0 gap-1 bg-[#13152a] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {EMOJI_CATEGORIES.map((cat, i) => (
          <button
            key={i}
            type="button"
            onClick={() => setActiveCategory(i)}
            className={`shrink-0 rounded-t-lg px-2 py-1.5 text-xs transition-colors ${
              activeCategory === i
                ? "bg-violet-600/20 text-violet-300"
                : "text-violet-400/60 hover:text-violet-200"
            }`}
          >
            {cat.label.split(" ")[0]}
          </button>
        ))}
      </div>

      {/* Category label */}
      <p className="px-3 pt-2 pb-1 text-[10px] font-semibold uppercase tracking-widest text-violet-400/60">
        {EMOJI_CATEGORIES[activeCategory].label.split(" ").slice(1).join(" ")}
      </p>

      {/* Emoji grid */}
      <div className="grid grid-cols-8 gap-0.5 overflow-y-auto px-2 pb-3 max-h-[200px] [scrollbar-width:thin] [scrollbar-color:#2a1f4a_transparent]">
        {EMOJI_CATEGORIES[activeCategory].emojis.map((emoji, i) => (
          <button
            key={i}
            type="button"
            onClick={() => onSelect(emoji)}
            className="flex h-9 w-9 items-center justify-center rounded-lg text-xl hover:bg-[#2a1f4a] transition-colors"
            title={emoji}
          >
            {emoji}
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── Message Input ────────────────────────────────────────────────────────────
export function MessageInput() {
  const [content, setContent] = useState("");
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [uploading, setUploading] = useState(false);
  const [recording, setRecording] = useState(false);
  const [showEmoji, setShowEmoji] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const typingTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const activeTarget = useChatStore((s) => s.activeTarget);
  const replyingTo = useChatStore((s) => s.replyingTo);
  const setReplyingTo = useChatStore((s) => s.setReplyingTo);
  const blockedUserIds = useChatStore((s) => s.blockedUserIds);
  const blockedByIds = useChatStore((s) => s.blockedByIds);

  const otherUserId = activeTarget?.type === "dm" ? activeTarget.conversation.other_user?.id : null;
  const iBlockedThem = otherUserId ? blockedUserIds.has(otherUserId) : false;
  const theyBlockedMe = otherUserId ? blockedByIds.has(otherUserId) : false;

  const emitTyping = (typing: boolean) => {
    if (!activeTarget) return;
    const payload =
      activeTarget.type === "room"
        ? { room_id: activeTarget.room.id, typing }
        : { conversation_id: activeTarget.conversation.id, typing };
    getSocket().emit(typing ? "typing_start" : "typing_stop", payload);
  };

  const handleChange = (value: string) => {
    setContent(value);
    emitTyping(true);
    if (typingTimeout.current) clearTimeout(typingTimeout.current);
    typingTimeout.current = setTimeout(() => emitTyping(false), 2000);
  };

  const insertEmoji = (emoji: string) => {
    const input = inputRef.current;
    if (!input) {
      setContent((c) => c + emoji);
      return;
    }
    const start = input.selectionStart ?? content.length;
    const end = input.selectionEnd ?? content.length;
    const next = content.slice(0, start) + emoji + content.slice(end);
    setContent(next);
    requestAnimationFrame(() => {
      input.setSelectionRange(start + emoji.length, start + emoji.length);
      input.focus();
    });
  };

  const handleSend = () => {
    if ((!content.trim() && attachments.length === 0) || !activeTarget) return;

    const base =
      activeTarget.type === "room"
        ? { room_id: activeTarget.room.id }
        : { conversation_id: activeTarget.conversation.id };

    const payload = {
      ...base,
      content: content.trim(),
      attachment_ids: attachments.map((a) => a.id),
      ...(replyingTo ? { parent_id: replyingTo.id } : {}),
    };

    getSocket().emit("send_message", payload);
    setContent("");
    setAttachments([]);
    setReplyingTo(null);
    emitTyping(false);
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;
    e.target.value = "";
    setUploading(true);
    try {
      const uploaded = await Promise.all(files.map(uploadFile));
      setAttachments((prev) => [...prev, ...uploaded]);
    } catch {
      // silently ignore
    } finally {
      setUploading(false);
    }
  };

  const handleRecorded = async (file: File) => {
    setRecording(false);
    setUploading(true);
    try {
      const uploaded = await uploadFile(file);
      setAttachments((prev) => [...prev, uploaded]);
    } catch {
      // silently ignore
    } finally {
      setUploading(false);
    }
  };

  const removeAttachment = (id: string) =>
    setAttachments((prev) => prev.filter((a) => a.id !== id));

  const handlePaste = async (e: React.ClipboardEvent) => {
    const imageItems = Array.from(e.clipboardData.items).filter((item) =>
      item.type.startsWith("image/"),
    );
    if (imageItems.length === 0) return;
    e.preventDefault();
    setUploading(true);
    try {
      const files = imageItems.map((item) => item.getAsFile()).filter(Boolean) as File[];
      const uploaded = await Promise.all(files.map(uploadFile));
      setAttachments((prev) => [...prev, ...uploaded]);
    } catch {
      // silently ignore
    } finally {
      setUploading(false);
    }
  };

  const targetLabel =
    activeTarget?.type === "room"
      ? activeTarget.room.name
      : activeTarget?.conversation.other_user?.display_name;

  if (!activeTarget) {
    return (
      <div className="border-t border-white/[0.06] px-4 py-6 text-center text-sm text-[#4a4e6a]">
        Select a group or conversation to start chatting
      </div>
    );
  }

  if (iBlockedThem) {
    return (
      <div className="border-t border-white/[0.06] px-4 py-4 text-center text-sm text-[#8b8fa8]">
        You have blocked this user.{" "}
        <button
          className="text-violet-500 hover:underline"
          onClick={() => otherUserId && useChatStore.getState().unblockUser(otherUserId)}
        >
          Unblock
        </button>{" "}
        to send messages.
      </div>
    );
  }

  if (theyBlockedMe) {
    return (
      <div className="border-t border-white/[0.06] px-4 py-4 text-center text-sm text-[#8b8fa8]">
        You cannot send messages to this user.
      </div>
    );
  }

  const canSend = (content.trim().length > 0 || attachments.length > 0) && !uploading;

  return (
    <div className="border-t border-white/[0.06] px-4 py-3">
      {/* Reply preview */}
      {replyingTo && (
        <div className="mb-2 flex items-center justify-between rounded-lg border border-white/[0.06] bg-[#0d0f1a] px-3 py-2">
          <div className="min-w-0 text-sm">
            <p className="text-xs text-violet-400">Replying to {replyingTo.author?.display_name || "Unknown"}</p>
            <p className="truncate text-[#8b8fa8]">{replyingTo.content}</p>
          </div>
          <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0 text-[#4a4e6a] hover:text-white" onClick={() => setReplyingTo(null)}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      )}

      {/* Attachment chips */}
      {attachments.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-2">
          {attachments.map((a) => (
            <div key={a.id} className="flex items-center gap-1 rounded-full border border-white/[0.06] bg-[#1e2040] px-3 py-1 text-xs text-[#c8cde8]">
              <span className="max-w-[120px] truncate">{a.filename}</span>
              <button onClick={() => removeAttachment(a.id)} className="text-[#4a4e6a] hover:text-white">
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      {recording ? (
        <AudioRecorder onRecorded={handleRecorded} onCancel={() => setRecording(false)} />
      ) : (
        <form
          onSubmit={(e) => { e.preventDefault(); handleSend(); }}
          className="flex items-center gap-2 rounded-xl border border-white/[0.06] bg-[#1a1d35] px-3 py-2"
        >
          <input
            ref={fileInputRef}
            type="file"
            multiple
            className="hidden"
            accept="image/*,audio/*,video/mp4,video/webm,application/pdf,.doc,.docx,.txt"
            onChange={handleFileChange}
          />

          {/* Paperclip */}
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0 text-[#4a4e6a] hover:text-white"
            title="Attach file"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
          >
            <Paperclip className="h-4 w-4" />
          </Button>

          {/* Mic */}
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0 text-[#4a4e6a] hover:text-white"
            title="Record audio"
            onClick={() => setRecording(true)}
            disabled={uploading}
          >
            <Mic className="h-4 w-4" />
          </Button>

          {/* Text input */}
          <input
            ref={inputRef}
            type="text"
            value={content}
            onChange={(e) => handleChange(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
            onPaste={handlePaste}
            placeholder={uploading ? "Uploading…" : `Type a message${targetLabel ? ` to ${targetLabel}` : ""}...`}
            className="flex-1 bg-transparent text-sm text-white placeholder:text-[#4a4e6a] focus:outline-none"
            disabled={uploading}
          />

          {/* Emoji button */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowEmoji((v) => !v)}
              className={`shrink-0 rounded-full transition-colors ${showEmoji ? "text-violet-400" : "text-[#4a4e6a] hover:text-white"}`}
              title="Emoji"
            >
              <Smile className="h-4 w-4" />
            </button>

            {showEmoji && (
              <EmojiPicker
                onSelect={(emoji) => { insertEmoji(emoji); }}
                onClose={() => setShowEmoji(false)}
              />
            )}
          </div>

          {/* Circle send */}
          <button
            type="submit"
            disabled={!canSend}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-violet-600 hover:bg-violet-500 text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Send className="h-4 w-4" />
          </button>
        </form>
      )}
    </div>
  );
}
