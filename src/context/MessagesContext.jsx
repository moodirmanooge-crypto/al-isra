import { createContext, useContext, useEffect, useRef, useState } from "react";
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

// ============================================================
// MessagesContext
// Isla xog-kayd (fariimaha macallinka) oo lagu wadaago:
//   - Sidebar (badge-ka "Messages")
//   - Topbar (bell dropdown)
//   - Dashboard / Messages page (liiska buuxa)
// Sidaas awgeed hal listener ayaa Firestore la xiraya, mana aha
// mid kasta oo component u leeyahay listener gaar ah.
// ============================================================

const MessagesContext = createContext(null);

export function MessagesProvider({ children }) {
  const [individualMsgs, setIndividualMsgs] = useState([]);
  const [groupMsgs, setGroupMsgs] = useState([]);
  const isFirstLoadIndividual = useRef(true);
  const isFirstLoadGroup = useRef(true);
  const seenIds = useRef(new Set());

  const teacherId = localStorage.getItem("teacherId") || "";

  // ---- Codso idanka Notification API ----
  useEffect(() => {
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission();
    }
  }, []);

  const fireBrowserNotification = (msg) => {
    if (!("Notification" in window)) return;
    if (Notification.permission !== "granted") return;

    const n = new Notification(msg.subject || "Fariin Cusub", {
      body: msg.body || msg.text || "",
      icon: "/school-icon.png",
      tag: msg.id,
    });
    n.onclick = () => window.focus();
  };

  // ---- Listener 1: fariimaha gaarka loo diray macallinkan ----
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

  // ---- Listener 2: fariimaha guud ee loo diray dhammaan macallimiinta ----
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

  const allMessages = [...individualMsgs, ...groupMsgs].sort((a, b) => {
    const ta = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(a.createdAt);
    const tb = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(b.createdAt);
    return tb - ta;
  });

  const unreadCount = allMessages.filter((m) => !m.read).length;

  const markAsRead = async (msg) => {
    if (!msg.read) {
      try {
        await updateDoc(doc(db, "messages", msg.id), { read: true });
      } catch (err) {
        console.log("Khalad marka la calaamadinayo read:", err);
      }
    }
  };

  const markAllAsRead = async () => {
    const unread = allMessages.filter((m) => !m.read);
    for (const m of unread) {
      try {
        await updateDoc(doc(db, "messages", m.id), { read: true });
      } catch (err) {
        console.log(err);
      }
    }
  };

  return (
    <MessagesContext.Provider
      value={{ allMessages, unreadCount, markAsRead, markAllAsRead }}
    >
      {children}
    </MessagesContext.Provider>
  );
}

export function useMessages() {
  const ctx = useContext(MessagesContext);
  if (!ctx) {
    throw new Error("useMessages waa in loo isticmaalaa MessagesProvider gudihiisa");
  }
  return ctx;
}