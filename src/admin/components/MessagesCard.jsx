//src/admin/components/MessagesCard.jsx
import { useEffect, useState } from "react";
import { X, Send, Users, UserRound, ChevronDown, Check, Megaphone } from "lucide-react";
import { db } from "../../firebase/firebase";
import { collection, getDocs, addDoc, serverTimestamp } from "firebase/firestore";

const AUDIENCE_OPTIONS = [
  { key: "all_teachers", label: "Dhammaan Macallimiinta", group: "teacher", icon: Users },
  { key: "one_teacher", label: "Macallin Gaar ah", group: "teacher", icon: UserRound },
  { key: "all_students", label: "Dhammaan Ardayda", group: "student", icon: Users },
  { key: "one_student", label: "Arday Gaar ah", group: "student", icon: UserRound },
  { key: "all_parents", label: "Dhammaan Waalidiinta", group: "parent", icon: Users },
  { key: "one_parent", label: "Waalid Gaar ah", group: "parent", icon: UserRound },
];

export default function MessagesCard({ messages = [] }) {
  const [open, setOpen] = useState(false);
  const [audience, setAudience] = useState("all_teachers");
  const [audienceMenuOpen, setAudienceMenuOpen] = useState(false);

  const [teachers, setTeachers] = useState([]);
  const [students, setStudents] = useState([]);
  const [parents, setParents] = useState([]);

  const [selectedRecipientId, setSelectedRecipientId] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [sentOk, setSentOk] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    if (open) fetchDirectory();
  }, [open]);

  async function fetchDirectory() {
    try {
      const teachersSnap = await getDocs(collection(db, "teachers"));
      setTeachers(teachersSnap.docs.map((d) => ({ id: d.id, ...d.data() })));

      const studentsSnap = await getDocs(collection(db, "students"));
      const studentsList = studentsSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setStudents(studentsList);

      const parentMap = new Map();
      studentsList.forEach((s) => {
        const key = s.parentUid || s.parentPhone;
        if (key && !parentMap.has(key)) {
          parentMap.set(key, {
            id: s.parentUid || s.parentPhone,
            uid: s.parentUid || null,
            phone: s.parentPhone || null,
            name: s.parentName || `Waalidka ${s.fullName || s.name || ""}`.trim(),
          });
        }
      });
      setParents(Array.from(parentMap.values()));
    } catch (err) {
      console.error("Khalad ayaa dhacay markii directory-ga la soo qaadanayay:", err);
    }
  }

  function resetForm() {
    setSubject("");
    setBody("");
    setSelectedRecipientId("");
    setSentOk(false);
    setErrorMsg("");
  }

  function closeModal() {
    setOpen(false);
    setAudienceMenuOpen(false);
    resetForm();
  }

  const currentOption = AUDIENCE_OPTIONS.find((o) => o.key === audience);
  const isSpecific = audience.startsWith("one_");

  function getRecipientList() {
    if (audience === "all_teachers" || audience === "one_teacher")
      return teachers.map((t) => ({ id: t.id, uid: t.uid || t.id, label: t.fullName || t.name || "Macallin" }));
    if (audience === "all_students" || audience === "one_student")
      return students.map((s) => ({ id: s.id, uid: s.uid || s.id, label: s.fullName || s.name || "Arday" }));
    if (audience === "all_parents" || audience === "one_parent")
      return parents.map((p) => ({ id: p.id, uid: p.uid, label: p.name }));
    return [];
  }

  async function handleSend() {
    setErrorMsg("");

    if (!subject.trim() || !body.trim()) {
      setErrorMsg("Fadlan buuxi mowduuca iyo fariinta.");
      return;
    }
    if (isSpecific && !selectedRecipientId) {
      setErrorMsg("Fadlan dooro qofka aad fariinta u dirayso.");
      return;
    }

    try {
      setSending(true);

      const recipientGroup = currentOption.group;
      const scope = isSpecific ? "individual" : "broadcast";

      let recipientId = null;
      let recipientUid = null;
      let recipientName = null;

      if (isSpecific) {
        const list = getRecipientList();
        const found = list.find((r) => r.id === selectedRecipientId);
        recipientId = selectedRecipientId;
        recipientUid = found ? found.uid : null;
        recipientName = found ? found.label : null;
      }

      // Dashboards (teacher / student / parent) should listen on "messages"
      // filtering by audienceGroup + scope, and by recipientId/recipientUid
      // when scope === "individual", so the message reaches only the
      // right dashboard(s) in real time.
      await addDoc(collection(db, "messages"), {
        subject: subject.trim(),
        text: body.trim(),
        body: body.trim(),
        senderName: "Admin",
        senderRole: "Admin",
        audienceGroup: recipientGroup,
        scope,
        recipientId,
        recipientUid,
        recipientName,
        read: false,
        createdAt: serverTimestamp(),
      });

      setSentOk(true);
      setTimeout(() => {
        closeModal();
      }, 1400);
    } catch (err) {
      console.error("Khalad ayaa dhacay markii fariinta la dirayay:", err);
      setErrorMsg("Fariinta lama dirin karin. Isku day mar kale.");
    } finally {
      setSending(false);
    }
  }

  const recipientList = getRecipientList();

  return (
    <>
      {/* Compact bottom bar (replaces the old tall purple box) */}
      <div
        style={{
          background: "linear-gradient(135deg,#2F1F8F,#4F46E5)",
          borderRadius: 18,
          color: "#fff",
          padding: "16px 22px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 16,
          flexWrap: "wrap",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
          <div
            style={{
              width: 40,
              height: 40,
              borderRadius: 12,
              background: "rgba(255,255,255,.14)",
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              flexShrink: 0,
            }}
          >
            <Megaphone size={19} />
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontWeight: 800, fontSize: 15.5, whiteSpace: "nowrap" }}>
              Dir Ogeysiin
            </div>
            <div style={{ fontSize: 12.5, color: "#dbeafe", whiteSpace: "nowrap" }}>
              {messages.length === 0
                ? "Weli fariin lama helin."
                : `${messages.length} fariimood ayaa jira.`}
            </div>
          </div>
        </div>

        <button
          onClick={() => setOpen(true)}
          style={{
            border: "none",
            borderRadius: 14,
            padding: "12px 22px",
            background: "#6D5DF0",
            color: "#fff",
            fontWeight: 700,
            fontSize: 13.5,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: 8,
            boxShadow: "0 8px 18px rgba(109,93,240,0.4)",
            flexShrink: 0,
          }}
        >
          <Send size={15} />
          Send Announcement
        </button>
      </div>

      {/* MODAL */}
      {open && (
        <div
          onClick={closeModal}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15,13,35,0.55)",
            backdropFilter: "blur(4px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
            padding: 20,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "100%",
              maxWidth: 480,
              background: "#ffffff",
              borderRadius: 22,
              color: "#111827",
              boxShadow: "0 20px 60px rgba(0,0,0,0.35)",
              overflow: "hidden",
              maxHeight: "90vh",
              display: "flex",
              flexDirection: "column",
            }}
          >
            {/* Header */}
            <div
              style={{
                background: "linear-gradient(135deg,#2F1F8F,#4F46E5)",
                color: "#fff",
                padding: "20px 24px",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                flexShrink: 0,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 12,
                    background: "rgba(255,255,255,0.15)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Send size={19} />
                </div>
                <div>
                  <div style={{ fontWeight: 800, fontSize: 17 }}>Dir Fariin</div>
                  <div style={{ fontSize: 12, opacity: 0.85 }}>
                    U dir ogeysiin qof ama koox
                  </div>
                </div>
              </div>

              <button
                onClick={closeModal}
                style={{
                  background: "rgba(255,255,255,0.15)",
                  border: "none",
                  borderRadius: 10,
                  width: 32,
                  height: 32,
                  color: "#fff",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <X size={17} />
              </button>
            </div>

            {/* Body (scrollable) */}
            <div style={{ padding: "22px 24px", overflowY: "auto" }}>
              {sentOk ? (
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    padding: "30px 10px",
                    textAlign: "center",
                  }}
                >
                  <div
                    style={{
                      width: 64,
                      height: 64,
                      borderRadius: "50%",
                      background: "#DCFCE7",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      marginBottom: 14,
                    }}
                  >
                    <Check size={30} color="#16A34A" />
                  </div>
                  <div style={{ fontWeight: 800, fontSize: 16, color: "#111827" }}>
                    Fariinta waa la diray!
                  </div>
                  <p style={{ fontSize: 13, color: "#6B7280", marginTop: 6 }}>
                    {currentOption.label} ayaa heli doona ogeysiinta dashboard-kooda.
                  </p>
                </div>
              ) : (
                <>
                  {/* Audience selector */}
                  <label
                    style={{
                      fontSize: 12.5,
                      fontWeight: 700,
                      color: "#6B7280",
                      display: "block",
                      marginBottom: 8,
                    }}
                  >
                    U dir
                  </label>

                  <div style={{ position: "relative", marginBottom: 18 }}>
                    <button
                      onClick={() => setAudienceMenuOpen((v) => !v)}
                      style={{
                        width: "100%",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        padding: "13px 16px",
                        borderRadius: 14,
                        border: "1.5px solid #E5E7EB",
                        background: "#F9FAFB",
                        cursor: "pointer",
                        fontSize: 14,
                        fontWeight: 600,
                        color: "#111827",
                      }}
                    >
                      <span style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <currentOption.icon size={17} color="#6D5DF0" />
                        {currentOption.label}
                      </span>
                      <ChevronDown
                        size={17}
                        color="#9CA3AF"
                        style={{
                          transform: audienceMenuOpen ? "rotate(180deg)" : "none",
                          transition: "transform .15s ease",
                        }}
                      />
                    </button>

                    {audienceMenuOpen && (
                      <div
                        style={{
                          position: "absolute",
                          top: "calc(100% + 6px)",
                          left: 0,
                          right: 0,
                          background: "#fff",
                          border: "1px solid #E5E7EB",
                          borderRadius: 14,
                          boxShadow: "0 12px 30px rgba(0,0,0,0.12)",
                          zIndex: 10,
                          overflow: "hidden",
                        }}
                      >
                        {AUDIENCE_OPTIONS.map((opt) => {
                          const OptIcon = opt.icon;
                          const active = opt.key === audience;
                          return (
                            <div
                              key={opt.key}
                              onClick={() => {
                                setAudience(opt.key);
                                setSelectedRecipientId("");
                                setAudienceMenuOpen(false);
                              }}
                              style={{
                                display: "flex",
                                alignItems: "center",
                                gap: 10,
                                padding: "11px 16px",
                                fontSize: 13.5,
                                fontWeight: active ? 700 : 500,
                                color: active ? "#6D5DF0" : "#374151",
                                background: active ? "#F5F3FF" : "#fff",
                                cursor: "pointer",
                              }}
                            >
                              <OptIcon size={16} />
                              {opt.label}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* Specific recipient picker */}
                  {isSpecific && (
                    <div style={{ marginBottom: 18 }}>
                      <label
                        style={{
                          fontSize: 12.5,
                          fontWeight: 700,
                          color: "#6B7280",
                          display: "block",
                          marginBottom: 8,
                        }}
                      >
                        Dooro{" "}
                        {currentOption.group === "teacher"
                          ? "Macallinka"
                          : currentOption.group === "student"
                          ? "Ardayga"
                          : "Waalidka"}
                      </label>

                      <select
                        value={selectedRecipientId}
                        onChange={(e) => setSelectedRecipientId(e.target.value)}
                        style={{
                          width: "100%",
                          padding: "12px 14px",
                          borderRadius: 14,
                          border: "1.5px solid #E5E7EB",
                          background: "#F9FAFB",
                          fontSize: 14,
                          color: "#111827",
                          outline: "none",
                        }}
                      >
                        <option value="">-- Dooro --</option>
                        {recipientList.map((r) => (
                          <option key={r.id} value={r.id}>
                            {r.label}
                          </option>
                        ))}
                      </select>

                      {recipientList.length === 0 && (
                        <p style={{ fontSize: 12, color: "#9CA3AF", marginTop: 6 }}>
                          Wax liis ah lama helin.
                        </p>
                      )}
                    </div>
                  )}

                  {/* Subject */}
                  <label
                    style={{
                      fontSize: 12.5,
                      fontWeight: 700,
                      color: "#6B7280",
                      display: "block",
                      marginBottom: 8,
                    }}
                  >
                    Mowduuca
                  </label>
                  <input
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    placeholder="Tusaale: Xafladda Aabbayaasha"
                    style={{
                      width: "100%",
                      padding: "12px 14px",
                      borderRadius: 14,
                      border: "1.5px solid #E5E7EB",
                      background: "#F9FAFB",
                      fontSize: 14,
                      color: "#111827",
                      outline: "none",
                      marginBottom: 18,
                      boxSizing: "border-box",
                    }}
                  />

                  {/* Message body */}
                  <label
                    style={{
                      fontSize: 12.5,
                      fontWeight: 700,
                      color: "#6B7280",
                      display: "block",
                      marginBottom: 8,
                    }}
                  >
                    Fariinta
                  </label>
                  <textarea
                    value={body}
                    onChange={(e) => setBody(e.target.value)}
                    placeholder="Qor fariinta halkan..."
                    rows={5}
                    style={{
                      width: "100%",
                      padding: "12px 14px",
                      borderRadius: 14,
                      border: "1.5px solid #E5E7EB",
                      background: "#F9FAFB",
                      fontSize: 14,
                      color: "#111827",
                      outline: "none",
                      resize: "vertical",
                      fontFamily: "inherit",
                      boxSizing: "border-box",
                    }}
                  />

                  {errorMsg && (
                    <p style={{ color: "#EF4444", fontSize: 13, marginTop: 12, fontWeight: 600 }}>
                      {errorMsg}
                    </p>
                  )}
                </>
              )}
            </div>

            {/* Footer */}
            {!sentOk && (
              <div
                style={{
                  padding: "16px 24px",
                  borderTop: "1px solid #F0F0F5",
                  display: "flex",
                  justifyContent: "flex-end",
                  gap: 10,
                  flexShrink: 0,
                }}
              >
                <button
                  onClick={closeModal}
                  style={{
                    padding: "12px 20px",
                    borderRadius: 14,
                    border: "1.5px solid #E5E7EB",
                    background: "#fff",
                    color: "#374151",
                    fontWeight: 700,
                    fontSize: 13.5,
                    cursor: "pointer",
                  }}
                >
                  Jooji
                </button>

                <button
                  onClick={handleSend}
                  disabled={sending}
                  style={{
                    padding: "12px 22px",
                    borderRadius: 14,
                    border: "none",
                    background: sending
                      ? "#A5A0F0"
                      : "linear-gradient(135deg,#6D5DF0,#8B5CF6)",
                    color: "#fff",
                    fontWeight: 700,
                    fontSize: 13.5,
                    cursor: sending ? "not-allowed" : "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    boxShadow: "0 8px 18px rgba(109,93,240,0.35)",
                  }}
                >
                  <Send size={15} />
                  {sending ? "Waa la dirayaa..." : "Dir Fariinta"}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}