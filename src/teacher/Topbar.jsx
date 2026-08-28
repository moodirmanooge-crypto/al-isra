// src/teacher/Topbar.jsx
import { useRef, useState } from "react";
import { Search, Bell, Mail, MailOpen, X } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useMessages } from "../context/MessagesContext"; // Hubi path-kan

function TopbarStyles() {
  return (
    <style>{`
      .tb-wrap {
        height: 90px;
        background: #0B1120;
        border-radius: 20px;
        margin: 20px;
        padding: 0 30px;
        display: flex;
        justify-content: space-between;
        align-items: center;
        color: #fff;
        position: relative;
        gap: 16px;
      }
      .tb-left { display: flex; align-items: center; gap: 20px; min-width: 0; }
      .tb-logo {
        width: 44px;
        height: 44px;
        border-radius: 12px;
        background: linear-gradient(135deg,#6D5DF0,#8B5CF6);
        display: none;
        align-items: center;
        justify-content: center;
        font-size: 20px;
        flex-shrink: 0;
      }
      .tb-title { margin: 0; font-size: 28px; font-weight: 700; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      .tb-subtitle { margin: 5px 0 0; color: #94A3B8; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      .tb-search {
        display: flex;
        align-items: center;
        gap: 10px;
        width: 280px;
        height: 55px;
        border-radius: 30px;
        background: #111827;
        padding: 0 18px;
        flex-shrink: 0;
      }
      .tb-right { display: flex; align-items: center; gap: 18px; flex-shrink: 0; }
      .tb-dropdown { width: 360px; max-width: 90vw; }

      /* Matches the student-portal mobile header: rounded card removed,
         compact logo + "Rising School / Teacher Portal" + bell only. */
      @media (max-width: 900px) {
        .tb-wrap {
          margin: 0;
          border-radius: 0;
          padding: 14px 16px;
          height: auto;
          min-height: 68px;
          border-bottom: 1px solid rgba(255,255,255,.08);
          position: sticky;
          top: 0;
          z-index: 40;
        }
        .tb-logo { display: flex; }
        .tb-title { font-size: 16px; }
        .tb-subtitle { display: none; }
        .tb-search { display: none; }
        .tb-right { gap: 10px; }
      }

      @media (max-width: 480px) {
        .tb-wrap { flex-wrap: nowrap; }
        .tb-title { font-size: 15px; }
      }
    `}</style>
  );
}

export default function Topbar({ teacherName = "Teacher" }) {
  const navigate = useNavigate();
  const { allMessages, unreadCount, markAsRead, markAllAsRead } = useMessages();

  const [open, setOpen] = useState(false);
  const [openMsg, setOpenMsg] = useState(null);
  const dropdownRef = useRef(null);

  const formatTime = (createdAt) => {
    if (!createdAt) return "";
    const d = createdAt.toDate ? createdAt.toDate() : new Date(createdAt);
    return d.toLocaleString();
  };

  const handleOpenMessage = (msg) => {
    markAsRead(msg);
    setOpenMsg(msg);
    setOpen(false);
  };

  return (
    <>
      <TopbarStyles />
      <div className="tb-wrap">
        {/* LEFT */}
        <div className="tb-left">
          <div className="tb-logo">🏫</div>
          <div style={{ minWidth: 0 }}>
            <h2 className="tb-title">Welcome, {teacherName} 👋</h2>
            <p className="tb-subtitle">
              Here's what's happening in your classes today.
            </p>
          </div>
        </div>

        {/* RIGHT */}
        <div className="tb-right">
          <div className="tb-search">
            <Search color="#94A3B8" size={20} />
            <input
              placeholder="Search anything..."
              style={{
                flex: 1,
                minWidth: 0,
                background: "transparent",
                border: "none",
                outline: "none",
                color: "#fff",
                fontSize: 15,
              }}
            />
          </div>

          {/* ---- Notification Bell (real, interactive) ---- */}
          <div style={{ position: "relative" }} ref={dropdownRef}>
            <div
              onClick={() => setOpen(!open)}
              style={{
                width: 46,
                height: 46,
                borderRadius: "50%",
                background: "#111827",
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
                position: "relative",
                cursor: "pointer",
                flexShrink: 0,
              }}
            >
              <Bell size={20} />
              {unreadCount > 0 && (
                <span
                  style={{
                    position: "absolute",
                    top: 4,
                    right: 4,
                    width: 16,
                    height: 16,
                    borderRadius: "50%",
                    background: "#EF4444",
                    color: "#fff",
                    fontSize: 10,
                    display: "flex",
                    justifyContent: "center",
                    alignItems: "center",
                    fontWeight: "bold",
                  }}
                >
                  {unreadCount > 9 ? "9+" : unreadCount}
                </span>
              )}
            </div>

            {/* ---- Dropdown ---- */}
            {open && (
              <>
                <div
                  onClick={() => setOpen(false)}
                  style={{ position: "fixed", inset: 0, zIndex: 999 }}
                />
                <div
                  className="tb-dropdown"
                  style={{
                    position: "absolute",
                    top: 56,
                    right: 0,
                    maxHeight: 420,
                    overflowY: "auto",
                    background: "#0B1120",
                    border: "1px solid rgba(255,255,255,.08)",
                    borderRadius: 18,
                    boxShadow: "0 20px 50px rgba(0,0,0,.5)",
                    zIndex: 1000,
                  }}
                >
                  <div
                    style={{
                      padding: "14px 18px",
                      borderBottom: "1px solid rgba(255,255,255,.06)",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                    }}
                  >
                    <strong style={{ color: "#fff" }}>Fariimaha</strong>
                    {unreadCount > 0 && (
                      <button
                        onClick={markAllAsRead}
                        style={{
                          border: "none",
                          background: "none",
                          color: "#8B5CF6",
                          fontSize: 12,
                          cursor: "pointer",
                        }}
                      >
                        Dhammaan calaamadi akhriyay
                      </button>
                    )}
                  </div>

                  {allMessages.length === 0 ? (
                    <p style={{ padding: 20, color: "#64748B", textAlign: "center" }}>
                      Weli fariin lama helin.
                    </p>
                  ) : (
                    allMessages.map((m) => (
                      <div
                        key={m.id}
                        onClick={() => handleOpenMessage(m)}
                        style={{
                          padding: "12px 18px",
                          borderBottom: "1px solid rgba(255,255,255,.05)",
                          cursor: "pointer",
                          background: m.read ? "transparent" : "rgba(139,92,246,.10)",
                          display: "flex",
                          gap: 10,
                        }}
                      >
                        {m.read ? (
                          <MailOpen size={16} color="#64748B" style={{ marginTop: 2, flexShrink: 0 }} />
                        ) : (
                          <Mail size={16} color="#8B5CF6" style={{ marginTop: 2, flexShrink: 0 }} />
                        )}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div
                            style={{
                              display: "flex",
                              justifyContent: "space-between",
                              gap: 8,
                            }}
                          >
                            <span
                              style={{
                                color: "#fff",
                                fontWeight: m.read ? 500 : 700,
                                fontSize: 14,
                                whiteSpace: "nowrap",
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                              }}
                            >
                              {m.subject || "(Cinwaan la'aan)"}
                            </span>
                          </div>
                          <p
                            style={{
                              margin: "2px 0 0",
                              color: "#94A3B8",
                              fontSize: 12,
                              whiteSpace: "nowrap",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                            }}
                          >
                            {m.body || m.text}
                          </p>
                          <span style={{ fontSize: 11, color: "#475569" }}>
                            {formatTime(m.createdAt)}
                          </span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </>
            )}
          </div>

          <div
            onClick={() => navigate("/teacher/profile")}
            title="Profile"
            style={{
              width: 46,
              height: 46,
              borderRadius: "50%",
              border: "3px solid #6D5DF0",
              background: "linear-gradient(135deg,#6D5DF0,#8B5CF6)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontWeight: 700,
              fontSize: 16,
              cursor: "pointer",
              overflow: "hidden",
              flexShrink: 0,
            }}
          >
            {localStorage.getItem("teacherPhoto") ? (
              <img
                src={localStorage.getItem("teacherPhoto")}
                alt="Teacher"
                style={{
                  width: "100%",
                  height: "100%",
                  borderRadius: "50%",
                  objectFit: "cover",
                }}
              />
            ) : (
              (localStorage.getItem("teacherName") || "T")
                .charAt(0)
                .toUpperCase()
            )}
          </div>
        </div>

        {/* ---- Modal-ka fariinta oo la furay ---- */}
        {openMsg && (
          <div
            onClick={() => setOpenMsg(null)}
            style={{
              position: "fixed",
              inset: 0,
              background: "rgba(0,0,0,.55)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              zIndex: 2000,
              padding: 16,
            }}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              style={{
                background: "#0B1120",
                border: "1px solid rgba(255,255,255,.08)",
                borderRadius: 20,
                padding: 28,
                width: "min(480px, 90vw)",
                boxShadow: "0 20px 60px rgba(0,0,0,.5)",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "flex-start",
                  marginBottom: 14,
                }}
              >
                <h2 style={{ margin: 0, color: "#fff", fontSize: 20 }}>
                  {openMsg.subject}
                </h2>
                <button
                  onClick={() => setOpenMsg(null)}
                  style={{ background: "none", border: "none", cursor: "pointer", color: "#94A3B8" }}
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
    </>
  );
}