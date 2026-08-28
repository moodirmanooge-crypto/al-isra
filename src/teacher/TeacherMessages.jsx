// src/teacher/TeacherMessages.jsx
import { useEffect, useState, useRef } from "react";
import { db } from "../firebase/firebase";
import {
  collection,
  query,
  where,
  onSnapshot,
  orderBy,
  doc,
  updateDoc,
} from "firebase/firestore";
import { Mail, MailOpen, X } from "lucide-react";

// ============================================================
// TeacherMessages
// - Wuxuu si real-time ah uga daawadaa collection-ka "messages"
//   labadaba: fariimaha gaarka loo diray macallinkan (recipientId)
//   iyo fariimaha guud ee loo diray dhammaan macallimiinta
//   (audienceGroup == "teacher" + scope == "group")
// - Marka fariin CUSUB timaado (mana jirin markii hore la load-ay),
//   waxaa la soo bandhigaa Browser Notification (Notification API),
//   xitaa haddii tab-ka browser-ku uu ku jiro background-ka.
// ============================================================
export default function TeacherMessages({ teacherId }) {
  const [individualMsgs, setIndividualMsgs] = useState([]);
  const [groupMsgs, setGroupMsgs] = useState([]);
  const [openMsg, setOpenMsg] = useState(null);
  const isFirstLoadIndividual = useRef(true);
  const isFirstLoadGroup = useRef(true);
  const seenIds = useRef(new Set());

  // ---- Codso idanka Notification API marka component-ku furmo ----
  useEffect(() => {
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission();
    }
  }, []);

  const fireBrowserNotification = (msg) => {
    if (!("Notification" in window)) return;
    if (Notification.permission !== "granted") return;

    const n = new Notification(msg.subject || "Fariin Cusub", {
      body: msg.body || "",
      icon: "/school-icon.png", // Badal path-kan haddii aad leedahay logo
      tag: msg.id, // Ka hortagga in isla fariintu labanlaab u soo baxdo
    });

    n.onclick = () => {
      window.focus();
      setOpenMsg(msg);
    };
  };

  // ---- Listener 1: Fariimaha gaarka loo diray macallinkan ----
  useEffect(() => {
    if (!teacherId) return;

    const qIndividual = query(
      collection(db, "messages"),
      where("recipientId", "==", teacherId),
      orderBy("createdAt", "desc")
    );

    const unsub = onSnapshot(qIndividual, (snap) => {
      const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setIndividualMsgs(list);

      if (!isFirstLoadIndividual.current) {
        snap.docChanges().forEach((change) => {
          if (change.type === "added") {
            const data = { id: change.doc.id, ...change.doc.data() };
            if (!seenIds.current.has(data.id)) {
              seenIds.current.add(data.id);
              fireBrowserNotification(data);
            }
          }
        });
      } else {
        list.forEach((m) => seenIds.current.add(m.id));
        isFirstLoadIndividual.current = false;
      }
    });

    return () => unsub();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teacherId]);

  // ---- Listener 2: Fariimaha guud ee loo diray dhammaan macallimiinta ----
  useEffect(() => {
    const qGroup = query(
      collection(db, "messages"),
      where("audienceGroup", "==", "teacher"),
      where("scope", "==", "group"),
      orderBy("createdAt", "desc")
    );

    const unsub = onSnapshot(qGroup, (snap) => {
      const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setGroupMsgs(list);

      if (!isFirstLoadGroup.current) {
        snap.docChanges().forEach((change) => {
          if (change.type === "added") {
            const data = { id: change.doc.id, ...change.doc.data() };
            if (!seenIds.current.has(data.id)) {
              seenIds.current.add(data.id);
              fireBrowserNotification(data);
            }
          }
        });
      } else {
        list.forEach((m) => seenIds.current.add(m.id));
        isFirstLoadGroup.current = false;
      }
    });

    return () => unsub();
  }, []);

  // ---- Isku dar labada liis, kala saar taariikhda ----
  const allMessages = [...individualMsgs, ...groupMsgs].sort((a, b) => {
    const ta = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(a.createdAt);
    const tb = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(b.createdAt);
    return tb - ta;
  });

  const unreadCount = allMessages.filter((m) => !m.read).length;

  const markAsRead = async (msg) => {
    setOpenMsg(msg);
    if (!msg.read) {
      try {
        await updateDoc(doc(db, "messages", msg.id), { read: true });
      } catch (err) {
        console.log("Khalad marka la calaamadinayo read:", err);
      }
    }
  };

  const formatTime = (createdAt) => {
    if (!createdAt) return "";
    const d = createdAt.toDate ? createdAt.toDate() : new Date(createdAt);
    return d.toLocaleString();
  };

  return (
    <div
      style={{
        background: "#0B1120",
        borderRadius: 20,
        padding: 24,
        marginBottom: 24,
        border: "1px solid rgba(255,255,255,.06)",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 16,
        }}
      >
        <h3 style={{ margin: 0, color: "#fff" }}>Fariimaha</h3>
        {unreadCount > 0 && (
          <span
            style={{
              background: "#EF4444",
              color: "white",
              borderRadius: 20,
              padding: "3px 12px",
              fontSize: 12,
              fontWeight: "bold",
            }}
          >
            {unreadCount} aan la akhrin
          </span>
        )}
      </div>

      {allMessages.length === 0 ? (
        <p style={{ color: "#94A3B8" }}>Weli fariin lama helin.</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {allMessages.map((m) => (
            <div
              key={m.id}
              onClick={() => markAsRead(m)}
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: 14,
                padding: "14px 16px",
                borderRadius: 15,
                cursor: "pointer",
                background: m.read
                  ? "#111827"
                  : "linear-gradient(90deg, rgba(109,93,240,0.18), rgba(139,92,246,0.10))",
                border: m.read
                  ? "1px solid rgba(255,255,255,.06)"
                  : "1px solid rgba(139,92,246,.35)",
                transition: "background .15s",
              }}
            >
              <div
                style={{
                  width: 38,
                  height: 38,
                  borderRadius: "50%",
                  background: m.read ? "rgba(148,163,184,.15)" : "rgba(139,92,246,.25)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                {m.read ? (
                  <MailOpen size={18} color="#94A3B8" />
                ) : (
                  <Mail size={18} color="#8B5CF6" />
                )}
              </div>

              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    gap: 8,
                  }}
                >
                  <span
                    style={{
                      color: "#fff",
                      fontWeight: m.read ? "500" : "700",
                      fontSize: 15,
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                  >
                    {m.subject || "(Cinwaan la\'aan)"}
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
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  {m.body}
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
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

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
                style={{
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  color: "#94A3B8",
                }}
              >
                <X size={22} />
              </button>
            </div>
            <p style={{ color: "#64748B", fontSize: 12, marginBottom: 16 }}>
              {formatTime(openMsg.createdAt)} •{" "}
              {openMsg.scope === "group" ? "Fariin Guud (Macallimiinta oo dhan)" : "Fariin Gaar ah"}
            </p>
            <p style={{ color: "#CBD5E1", fontSize: 15, lineHeight: 1.6 }}>
              {openMsg.body}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}