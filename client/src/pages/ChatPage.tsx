// Party chat room. OWNER: D  (SRS FR-87 to FR-99, FR-106, FR-107, IR-27 to IR-29)
// TODO (D): load older messages on scroll (FR-90), unread counts, images, mentions,
//           delete within 5 minutes, settlements (FR-109+).
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { fetchMessages, getSocket, joinRoom, sendChatMessage } from "../api/chat";
import { fetchParty } from "../api/parties";
import type { ChatMessage } from "../api/types";
import { useAuth } from "../auth/AuthContext";
import { Button, ErrorBox, Input, LoadingBlock, StatusBadge, useToast } from "../components/ui";
import { formatDateTime, formatTime } from "../lib/format";

export function ChatPage() {
  const { id: partyId = "" } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const queryClient = useQueryClient();

  const party = useQuery({ queryKey: ["party", partyId], queryFn: () => fetchParty(partyId) });
  const history = useQuery({
    queryKey: ["messages", partyId],
    queryFn: () => fetchMessages(partyId),
  });

  const [live, setLive] = useState<ChatMessage[]>([]);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Connect to the live chat room and listen for new messages.
  useEffect(() => {
    const socket = getSocket();
    const onMessage = (m: ChatMessage) => {
      if (m.partyId !== partyId) return;
      setLive((prev) => (prev.some((x) => x.id === m.id) ? prev : [...prev, m]));
      if (m.type === "SYSTEM") queryClient.invalidateQueries({ queryKey: ["party", partyId] }); // member count etc.
    };
    const onKicked = (e: { partyId: string }) => {
      if (e.partyId === partyId) navigate(`/parties/${partyId}`);
    };
    // Join the live room, then reload history so nothing sent in between is missed.
    // Runs again after a dropped connection comes back.
    const onConnect = async () => {
      await joinRoom(partyId);
      queryClient.invalidateQueries({ queryKey: ["messages", partyId] });
    };

    socket.on("chat:message", onMessage);
    socket.on("chat:kicked", onKicked);
    socket.on("connect", onConnect);
    if (socket.connected) onConnect();

    return () => {
      socket.emit("chat:leave", { partyId });
      socket.off("chat:message", onMessage);
      socket.off("chat:kicked", onKicked);
      socket.off("connect", onConnect);
    };
  }, [partyId, navigate, queryClient]);

  // History from the server + messages that arrived live, without duplicates.
  const all = [
    ...(history.data ?? []),
    ...live.filter((m) => !history.data?.some((h) => h.id === m.id)),
  ];

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [all.length]);

  async function onSend(e: FormEvent) {
    e.preventDefault();
    const body = text.trim();
    if (!body) return; // FR-99
    setSending(true);
    const res = await sendChatMessage(partyId, body);
    setSending(false);
    if (res.ok) setText("");
    else toast.error(res.error ?? "Could not send the message.");
  }

  if (party.isPending || history.isPending) return <LoadingBlock />;
  if (party.error) return <ErrorBox error={party.error} />;
  if (history.error) return <ErrorBox error={history.error} />;
  const p = party.data;

  return (
    <div className="mx-auto flex h-[calc(100vh-10rem)] max-w-3xl flex-col rounded-xl border border-slate-200 bg-white shadow-sm sm:h-[calc(100vh-9rem)]">
      {/* Header always shows the key party info (IR-28) */}
      <Link
        to={`/parties/${partyId}`}
        className="flex items-center justify-between gap-3 border-b border-slate-200 px-4 py-3 hover:bg-slate-50"
      >
        <div className="min-w-0">
          <h1 className="truncate font-semibold">
            {p.title} · {p.gameName}
          </h1>
          <p className="truncate text-xs text-slate-500">
            {formatDateTime(p.startAt)} · {p.locationName} · 👥 {p.memberCount}/{p.capacity}
          </p>
        </div>
        <StatusBadge status={p.status} />
      </Link>

      <ol className="flex-1 space-y-3 overflow-y-auto px-4 py-4" aria-label="Messages">
        {all.map((m) =>
          m.type === "SYSTEM" ? (
            // System messages look different from user messages (IR-29, FR-107)
            <li key={m.id} className="text-center text-xs text-slate-500">
              <span className="rounded-full bg-slate-100 px-3 py-1">{m.body}</span>
            </li>
          ) : (
            <MessageBubble key={m.id} message={m} mine={m.sender?.id === user?.id} />
          ),
        )}
        <div ref={bottomRef} />
      </ol>

      <form onSubmit={onSend} className="flex gap-2 border-t border-slate-200 p-3">
        <Input
          placeholder="Write a message..."
          value={text}
          onChange={(e) => setText(e.target.value)}
          maxLength={2000}
          aria-label="Message"
          disabled={p.status === "CANCELLED"}
        />
        <Button type="submit" loading={sending} disabled={!text.trim() || p.status === "CANCELLED"}>
          Send
        </Button>
      </form>
    </div>
  );
}

function MessageBubble({ message, mine }: { message: ChatMessage; mine: boolean }) {
  return (
    <li className={`flex flex-col ${mine ? "items-end" : "items-start"}`}>
      {!mine && (
        <span className="mb-0.5 text-xs font-medium text-slate-600">
          {message.sender?.nickname}
        </span>
      )}
      <div className="flex max-w-[80%] items-end gap-1.5">
        {mine && (
          <time className="whitespace-nowrap text-[10px] text-slate-400">
            {formatTime(message.createdAt)}
          </time>
        )}
        <p
          className={`whitespace-pre-wrap break-words rounded-2xl px-3 py-2 text-sm ${mine ? "bg-brand-600 text-white" : "bg-slate-100 text-slate-900"}`}
        >
          {message.body}
        </p>
        {!mine && (
          <time className="whitespace-nowrap text-[10px] text-slate-400">
            {formatTime(message.createdAt)}
          </time>
        )}
      </div>
    </li>
  );
}
