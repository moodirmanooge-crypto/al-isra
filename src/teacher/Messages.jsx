// src/teacher/Messages.jsx
import { useState } from "react";
import { Mail, MailOpen, X } from "lucide-react";
import Sidebar from "./Sidebar";
import Topbar from "./Topbar";
import MobileBottomNav from "./MobileBottomNav";
import { useMessages } from "../context/MessagesContext"; // Hubi path-kan

function MessagesStyles() {
  return (
    <style>{`
      .msg-layout { display: flex; min-height: 100vh; background: #05070D; }
      .msg-content { flex: 1; display: flex; flex-direction: column; min-width: 0; }
      .msg-body { padding: 0 20px 30px; }
      .msg-row { display: flex; align-items: flex-start; gap: 14px; }
      .msg-modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,.55); display: flex; align-items: center; justify-content: center; z-index: 2000; padding: 16px; box-sizing: border-box; }
      .msg-modal { background: #0B1120; border: 1px solid rgba(255,255,255,.08); border-radius: 20px; padding: 28px; width: min(480px, 90vw); box-shadow: 0 20px 60px rgba(0,0,0,.5); max-height: 85vh; overflow-y: auto; box-sizing: border-box; }

      @media (max-width: 900px) {
        .msg-body { padding: 0 14px 90px; }
        .msg-panel { padding: 16px !important; border-radius: 16px !important; }
        .msg-row { padding: 12px 14px !important; gap: 10px !important; }
        .msg-header-row { flex-direction: column; align-items: flex-start !important; gap: 10px; }
        .msg-modal { padding: 20px; width: 100%; }
      }
    `}</style>
  );
}

export default function Messages() {
  const [teacherName] = useState(localStorage.getItem("teacherName") || "Teacher");
  const { allMessages, unreadCount, markAsRead, markAllAsRead } = useMessages();
  const [openMsg, setOpenMsg] = useState(null);

  const formatTime = (createdAt) => {
    if (!createdAt) return "";
    const d = createdAt.toDate ? createdAt.toDate() : new Date(createdAt);
    return d.toLocaleString();
  };

  const handleOpen = (msg) => {
    markAsRead(msg);
    setOpenMsg(msg);
  };

  return (
    <div className="msg-layout">
      <MessagesStyles />
      <Sidebar teacherName={teacherName} />

      <div className="msg-content">
        <Topbar teacherName={teacherName} />

        <div className="msg-body">
          <div
            className="msg-panel"
            style={{
              background: "#0B1120",
              borderRadius: 20,
              padding: 24,
              border: "1px solid rgba(255,255,255,.06)",
            }}
          >
            <div
              className="msg-header-row"
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: 20,
                flexWrap: "wrap",
                gap: 10,
              }}
            >
              <h2 style={{ margin: 0, color: "#fff" }}>Fariimaha</h2>
              {unreadCount > 0 && (
                <button
                  onClick={markAllAsRead}
                  style={{
                    border: "none",
                    background: "rgba(139,92,246,.15)",
                    color: "#8B5CF6",
                    padding: "8px 16px",
                    borderRadius: 12,
                    cursor: "pointer",
                    fontWeight: 600,
                    fontSize: 13,
                  }}
                >
                  Dhammaan calaamadi akhriyay ({unreadCount})
                </button>
              )}
            </div>

            {allMessages.length === 0 ? (
              <p style={{ color: "#94A3B8" }}>Weli fariin lama helin.</p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {allMessages.map((m) => (
                  <div
                    key={m.id}
                    onClick={() => handleOpen(m)}
                    className="msg-row"
                    style={{
                      padding: "16px 18px",
                      borderRadius: 15,
                      cursor: "pointer",
                      background: m.read
                        ? "#111827"
                        : "linear-gradient(90deg, rgba(109,93,240,0.18), rgba(139,92,246,0.10))",
                      border: m.read
                        ? "1px solid rgba(255,255,255,.06)"
                        : "1px solid rgba(139,92,246,.35)",
                    }}
                  >
                    <div
                      style={{
                        width: 40,
                        height: 40,
                        borderRadius: "50%",
                        background: m.read ? "rgba(148,163,184,.15)" : "rgba(139,92,246,.25)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        flexShrink: 0,
                      }}
                    >
                      {m.read ? (
                        <MailOpen size={19} color="#94A3B8" />
                      ) : (
                        <Mail size={19} color="#8B5CF6" />
                      )}
                    </div>

                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          gap: 8,
                          flexWrap: "wrap",
                        }}
                      >
                        <span
                          style={{
                            color: "#fff",
                            fontWeight: m.read ? 500 : 700,
                            fontSize: 15,
                          }}
                        >
                          {m.subject || "(Cinwaan la'aan)"}
                        </span>
                        <span style={{ color: "#64748B", fontSize: 12, flexShrink: 0 }}>
                          {formatTime(m.createdAt)}
                        </span>
                      </div>
                      <p
                        style={{
                          margin: "4px 0 0",
                          color: "#94A3B8",
                          fontSize: 13,
                        }}
                      >
                        {m.body || m.text}
                      </p>
                      <span
                        style={{
                          display: "inline-block",
                          marginTop: 6,
                          fontSize: 11,
                          color: "#8B5CF6",
                          background: "rgba(139,92,246,.12)",
                          padding: "2px 8px",
                          borderRadius: 10,
                        }}
                      >
                        {m.scope === "group" ? "Fariin Guud" : "Fariin Gaar ah"}
                        {m.senderName ? ` • ${m.senderName}` : ""}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Bottom tab bar — mobile only (hidden via CSS on desktop) */}
      <MobileBottomNav />

      {/* ---- Modal ---- */}
      {openMsg && (
        <div onClick={() => setOpenMsg(null)} className="msg-modal-overlay">
          <div onClick={(e) => e.stopPropagation()} className="msg-modal">
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "flex-start",
                marginBottom: 14,
                gap: 10,
              }}
            >
              <h2 style={{ margin: 0, color: "#fff", fontSize: 20 }}>
                {openMsg.subject}
              </h2>
              <button
                onClick={() => setOpenMsg(null)}
                style={{ background: "none", border: "none", cursor: "pointer", color: "#94A3B8", flexShrink: 0 }}
              >
                <X size={22} />
              </button>
            </div>
            <p style={{ color: "#64748B", fontSize: 12, marginBottom: 16 }}>
              {formatTime(openMsg.createdAt)} •{" "}
              {openMsg.scope === "group" ? "Fariin Guud" : "Fariin Gaar ah"}
            </p>
            <p style={{ color: "#CBD5E1", fontSize: 15, lineHeight: 1.6 }}>
              {openMsg.body || openMsg.text}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}