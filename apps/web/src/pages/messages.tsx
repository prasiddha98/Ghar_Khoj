import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useRoute } from "wouter";
import { Send, Lock, ArrowLeft, Circle, Building, MessageSquare, Paperclip, X, Image, Video, Loader2, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useGetMessages, useSendMessage, getGetMessagesQueryKey, customFetch } from "@workspace/api-client-react";
import { Link, useLocation } from "wouter";
import { format, isToday, isYesterday } from "date-fns";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { uploadFile } from "@/hooks/use-upload";
import { useToast } from "@/hooks/use-toast";
import { BackButton } from "@/components/back-button";
import { ContractDialog } from "@/components/contract-dialog";

interface ConvPartner {
  id: number; firstName: string; lastName?: string; role: string; isVerified: boolean;
}
interface LastMessage {
  id: number; senderId: number; receiverId: number; content: string;
  roomId?: number; isRead: boolean; createdAt: string;
  mediaUrl?: string; mediaType?: string;
}
interface Conversation {
  partnerId: number;
  partner?: ConvPartner;
  lastMessage: LastMessage;
  unreadCount: number;
}
interface ThreadMessage {
  id: number;
  senderId: number;
  receiverId: number;
  content: string;
  roomId?: number;
  isRead: boolean;
  createdAt: string;
  mediaUrl?: string;
  mediaType?: string;
}
interface MessageListResponseWithPartner {
  messages: ThreadMessage[];
  partner: {
    id: number;
    firstName: string;
    lastName?: string;
    isVerified: boolean;
  };
}

function formatMsgTime(dateStr: string) {
  const d = new Date(dateStr);
  if (isToday(d)) return format(d, "h:mm a");
  if (isYesterday(d)) return "Yesterday";
  return format(d, "MMM d");
}

function useConversations(userId: number | undefined, enabled: boolean) {
  const [data, setData] = useState<{ conversations: Conversation[] } | null>(null);
  const [loading, setLoading] = useState(true);

  const refetch = async () => {
    if (!userId || !enabled) {
      console.log("[useConversations] Skipping fetch - userId:", userId, "enabled:", enabled);
      setLoading(false);
      return;
    }
    
    try {
      console.log("[useConversations] Checking token...");
      const token = localStorage.getItem("ghar_khoj_jwt");
      console.log("[useConversations] Token exists:", !!token);
      
      setLoading(true);
      console.log("[useConversations] Calling customFetch for userId:", userId);
      const result = await customFetch<{ conversations: Conversation[] }>(
        `/api/messages/conversations/${userId}`
      );
      console.log("[useConversations] Success! Got", result?.conversations?.length, "conversations");
      setData(result);
    } catch (err: any) {
      console.error("[useConversations] Error:", err?.message || err);
      console.error("[useConversations] Full error:", err);
      setData({ conversations: [] });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { 
    console.log("[useConversations useEffect] Triggering refetch");
    refetch(); 
  }, [userId, enabled]);

  return { data, loading, refetch };
}

export default function Messages() {
  const { user, userId, isRealUser, isVerified } = useAuth();
  const [, params] = useRoute("/messages/:userId/:ownerId");
  const { toast } = useToast();

  const [activeConvId, setActiveConvId] = useState<number | null>(
    params?.ownerId ? parseInt(params.ownerId) : null
  );
  const [newMessage, setNewMessage] = useState("");
  const [, navigate] = useLocation();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadingMedia, setUploadingMedia] = useState(false);
  const [mediaPreview, setMediaPreview] = useState<{ file: File; preview: string; type: "image" | "video" } | null>(null);

  const convs = useConversations(userId ?? undefined, !!userId && isRealUser);

  const { data: threadData, refetch: refetchThread } = useGetMessages(
    userId ?? 0, activeConvId ?? 0,
    { query: { queryKey: getGetMessagesQueryKey(userId ?? 0, activeConvId ?? 0), enabled: !!activeConvId && !!userId && isRealUser, refetchInterval: 3000 } }
  ) as { data: MessageListResponseWithPartner | undefined; refetch: any };

  const sendMutation = useSendMessage({
    mutation: {
      onSuccess: () => { setNewMessage(""); setMediaPreview(null); refetchThread(); convs.refetch(); },
    }
  });

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [threadData?.messages]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if ((!newMessage.trim() && !mediaPreview) || !user || !activeConvId) return;

    if (mediaPreview) {
      setUploadingMedia(true);
      try {
        const result = await uploadFile(mediaPreview.file);
        sendMutation.mutate({
          data: {
            senderId: user.id,
            receiverId: activeConvId,
            content: newMessage.trim() || "",
            mediaUrl: result.url,
            mediaType: mediaPreview.type,
          }
        });
      } catch {
        toast({ title: "Media upload failed", variant: "destructive" });
      } finally {
        setUploadingMedia(false);
      }
    } else {
      sendMutation.mutate({
        data: { senderId: user.id, receiverId: activeConvId, content: newMessage }
      });
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const isVideo = file.type.startsWith("video/");
    const isImage = file.type.startsWith("image/");
    if (!isImage && !isVideo) {
      toast({ title: "Only images and videos are supported", variant: "destructive" });
      return;
    }
    const reader = new FileReader();
    reader.onload = ev => setMediaPreview({ file, preview: ev.target?.result as string, type: isVideo ? "video" : "image" });
    reader.readAsDataURL(file);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const activePartner = convs.data?.conversations?.find(c => c.partnerId === activeConvId)?.partner || threadData?.partner;
  const partnerName = activePartner ? `${activePartner.firstName} ${activePartner.lastName || ""}`.trim() : `User #${activeConvId}`;
  const partnerInitial = partnerName[0] || "?";

  if (!isRealUser) {
    return (
      <div className="h-[70vh] flex flex-col items-center justify-center text-center p-6 max-w-md mx-auto">
        <BackButton fallback="/" label="Back" className="mb-6 text-left" />
        <div className="w-24 h-24 bg-gradient-to-br from-muted to-muted/50 rounded-full flex items-center justify-center mb-6 shadow-inner">
          <Lock className="text-muted-foreground" size={40} />
        </div>
        <h2 className="text-2xl font-bold mb-3">Sign In Required</h2>
        <p className="text-muted-foreground mb-8 leading-relaxed">
          You must sign in to access messages and start chatting with room owners.
        </p>
        <Link href="/login">
          <Button size="lg" className="w-full rounded-xl bg-primary shadow-lg shadow-primary/25">
            Sign In to View Messages
          </Button>
        </Link>
      </div>
    );
  }

  if (!isVerified) {
    return (
      <div className="h-[70vh] flex flex-col items-center justify-center text-center p-6 max-w-md mx-auto">
        <BackButton fallback="/" label="Back" className="mb-6 text-left" />
        <div className="w-24 h-24 bg-gradient-to-br from-muted to-muted/50 rounded-full flex items-center justify-center mb-6 shadow-inner">
          <Lock className="text-muted-foreground" size={40} />
        </div>
        <h2 className="text-2xl font-bold mb-3">Messaging Locked</h2>
        <p className="text-muted-foreground mb-8 leading-relaxed">
          To protect our community, messaging is only available to identity-verified users. Verify your ID to start chatting.
        </p>
        <Link href="/verification">
          <Button size="lg" className="w-full rounded-xl bg-primary shadow-lg shadow-primary/25">
            Verify Identity to Unlock Chat
          </Button>
        </Link>
      </div>
    );
  }

  const hasConversations = (convs.data?.conversations?.length ?? 0) > 0;

  return (
    <div className="bg-white rounded-3xl border shadow-sm overflow-hidden h-[calc(100vh-120px)] md:h-[calc(100vh-108px)] flex max-w-5xl mx-auto">

      {/* LEFT: Conversation List */}
      <div className={cn("w-full md:w-80 border-r flex flex-col shrink-0 bg-muted/10", activeConvId ? "hidden md:flex" : "flex")}>
        <div className="p-4 border-b bg-white">
          <div className="flex items-center gap-3 mb-2">
            <BackButton fallback="/messages" label="Back" className="" />
            <div>
              <h2 className="font-extrabold text-lg">Messages</h2>
              <p className="text-xs text-muted-foreground mt-0.5">Your verified chats</p>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {convs.data?.conversations?.map(conv => {
            const name = conv.partner
              ? `${conv.partner.firstName} ${conv.partner.lastName || ""}`.trim()
              : `User #${conv.partnerId}`;
            const isActive = activeConvId === conv.partnerId;
            const lastContent = conv.lastMessage.mediaUrl
              ? (conv.lastMessage.mediaType === "video" ? "📹 Video" : "📷 Photo")
              : conv.lastMessage.content;
            return (
              <button key={conv.partnerId} onClick={() => setActiveConvId(conv.partnerId)}
                className={cn("w-full flex items-center gap-3 px-4 py-3.5 hover:bg-muted/40 transition-colors border-b border-border/30 text-left",
                  isActive && "bg-primary/5 border-l-2 border-l-primary")}>
                <div className="relative shrink-0">
                  <div className="w-11 h-11 rounded-full bg-gradient-to-br from-primary to-rose-600 text-white flex items-center justify-center font-bold text-sm shadow">
                    {name[0]}
                  </div>
                  {conv.partner?.isVerified && (
                    <span className="absolute -bottom-0.5 -right-0.5 bg-green-500 border-2 border-white rounded-full w-3.5 h-3.5" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-0.5">
                    <p className="font-semibold text-sm truncate">{name}</p>
                    <p className="text-[10px] text-muted-foreground shrink-0 ml-2">{formatMsgTime(conv.lastMessage.createdAt)}</p>
                  </div>
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-muted-foreground truncate">
                      {conv.lastMessage.senderId === user?.id ? "You: " : ""}{lastContent}
                    </p>
                    {conv.unreadCount > 0 && (
                      <span className="bg-primary text-white text-[10px] rounded-full flex items-center justify-center font-bold ml-1 shrink-0 px-1.5 py-0.5">
                        {conv.unreadCount}
                      </span>
                    )}
                  </div>
                </div>
              </button>
            );
          })}

          {!hasConversations && (
            <div className="flex flex-col items-center justify-center h-48 text-muted-foreground text-center px-4">
              <MessageSquare size={36} className="mb-3 opacity-30" />
              <p className="text-sm font-medium">No conversations yet</p>
              <p className="text-xs mt-1">Go to a room listing and click "Show Interest" to start chatting once matched</p>
            </div>
          )}
        </div>
      </div>

      {/* RIGHT: Chat Thread */}
      <div className={cn("flex-1 flex flex-col", !activeConvId ? "hidden md:flex" : "flex")}>
        {!activeConvId ? (
          <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground">
            <MessageSquare size={48} className="mb-4 opacity-20" />
            <p className="font-semibold">Select a conversation</p>
            <p className="text-sm mt-1">Choose a chat from the left to start messaging</p>
          </div>
        ) : (
          <>
            {/* Chat Header */}
            <div className="h-16 border-b flex items-center px-4 gap-3 bg-white shrink-0 shadow-sm">
              <button className="md:hidden text-muted-foreground hover:text-foreground p-1" onClick={() => setActiveConvId(null)}>
                <ArrowLeft size={20} />
              </button>
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-green-500 to-emerald-600 text-white flex items-center justify-center font-bold text-sm shadow">
                {partnerInitial}
              </div>
              <div className="flex-1">
                <p className="font-bold text-sm">{partnerName}</p>
                <p className="text-xs text-green-600 font-medium flex items-center gap-1">
                  <Circle size={8} className="fill-green-500" /> Verified user
                </p>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1 text-xs text-muted-foreground bg-muted/40 px-3 py-1.5 rounded-full">
                  <Building size={12} /> Room inquiry
                </div>
                {activeConvId && user?.role === "owner" && (
                  <ContractDialog
                    tenantId={activeConvId}
                    ownerId={user.id}
                    tenantName={partnerName}
                    ownerName={`${user.firstName} ${user.lastName || ""}`.trim()}
                  />
                )}
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-4 py-6 bg-slate-50/60 flex flex-col gap-3">
              {(!threadData?.messages || threadData.messages.length === 0) && (
                <div className="flex-1 flex flex-col items-center justify-center text-center opacity-50">
                  <MessageSquare size={36} className="mb-3 text-muted-foreground" />
                  <p className="font-medium text-muted-foreground">No messages yet</p>
                  <p className="text-xs text-muted-foreground mt-1">Send a message to start the conversation</p>
                </div>
              )}

              {threadData?.messages && threadData.messages.length > 0 && (() => {
                const msgs = threadData.messages;
                const result: React.ReactElement[] = [];
                let lastDate = "";

                msgs.forEach((msg) => {
                  const msgDate = format(new Date(msg.createdAt), "MMM d, yyyy");
                  if (msgDate !== lastDate) {
                    lastDate = msgDate;
                    result.push(
                      <div key={`sep-${msgDate}`} className="flex items-center gap-3 my-2">
                        <div className="flex-1 h-px bg-border/60" />
                        <span className="text-xs text-muted-foreground bg-white border px-3 py-1 rounded-full font-medium">
                          {isToday(new Date(msg.createdAt)) ? "Today" : isYesterday(new Date(msg.createdAt)) ? "Yesterday" : msgDate}
                        </span>
                        <div className="flex-1 h-px bg-border/60" />
                      </div>
                    );
                  }

                  const isMe = msg.senderId === user?.id;
                  const hasMedia = !!(msg as any).mediaUrl;
                  const mediaType = (msg as any).mediaType;
                  const mediaUrl = (msg as any).mediaUrl;

                  result.push(
                    <motion.div key={msg.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                      className={`flex ${isMe ? "justify-end" : "justify-start"}`}>
                      <div className={cn("max-w-[72%] md:max-w-[65%]", isMe ? "items-end" : "items-start", "flex flex-col gap-1")}>
                        <div className={cn("rounded-2xl shadow-sm text-sm leading-relaxed overflow-hidden",
                          isMe ? "bg-primary text-white rounded-br-sm" : "bg-white border text-foreground rounded-bl-sm",
                          hasMedia ? "p-0" : "px-4 py-2.5"
                        )}>
                          {hasMedia && mediaType === "image" && (
                            <a href={mediaUrl} target="_blank" rel="noopener noreferrer">
                              <img src={mediaUrl} alt="Image" className="max-w-full max-h-60 object-cover rounded-2xl" />
                            </a>
                          )}
                          {hasMedia && mediaType === "video" && (
                            <video src={mediaUrl} controls className="max-w-full max-h-60 rounded-2xl" />
                          )}
                          {msg.content && (
                            <p className={cn(hasMedia && "px-4 py-2", !hasMedia && "")}>{msg.content}</p>
                          )}
                        </div>
                        <p className={cn("text-[10px] px-1", isMe ? "text-muted-foreground text-right" : "text-muted-foreground")}>
                          {format(new Date(msg.createdAt), "h:mm a")}
                          {isMe && msg.isRead && <span className="ml-1 text-blue-500">✓✓</span>}
                        </p>
                      </div>
                    </motion.div>
                  );
                });
                return result;
              })()}
              <div ref={messagesEndRef} />
            </div>

            {/* Media preview */}
            {mediaPreview && (
              <div className="px-3 pt-2 bg-white border-t">
                <div className="relative inline-block">
                  {mediaPreview.type === "image"
                    ? <img src={mediaPreview.preview} alt="Preview" className="h-20 w-20 object-cover rounded-xl border" />
                    : <video src={mediaPreview.preview} className="h-20 w-20 object-cover rounded-xl border" />
                  }
                  <button
                    type="button"
                    onClick={() => setMediaPreview(null)}
                    className="absolute -top-1.5 -right-1.5 bg-destructive text-white rounded-full w-5 h-5 flex items-center justify-center"
                  >
                    <X size={10} />
                  </button>
                </div>
              </div>
            )}

            {/* Input */}
            <form onSubmit={handleSend} className="p-3 border-t bg-white shrink-0 flex gap-2 items-end">
              <input ref={fileInputRef} type="file" accept="image/*,video/*" className="hidden" onChange={handleFileSelect} />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="h-12 w-12 rounded-2xl shrink-0 flex items-center justify-center border border-border hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
              >
                <Paperclip size={18} />
              </button>
              <div className="flex-1 relative">
                <Input
                  value={newMessage}
                  onChange={e => setNewMessage(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(e); } }}
                  placeholder={mediaPreview ? "Add a caption…" : `Message ${partnerName}...`}
                  className="h-12 rounded-2xl bg-muted/30 border-transparent focus-visible:border-primary focus-visible:bg-white pr-4 text-sm"
                />
              </div>
              <Button
                type="submit"
                disabled={(!newMessage.trim() && !mediaPreview) || sendMutation.isPending || uploadingMedia}
                className="h-12 w-12 rounded-2xl shrink-0 bg-primary hover:bg-primary/90 shadow-md shadow-primary/25"
              >
                {uploadingMedia ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} className="translate-x-0.5" />}
              </Button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
