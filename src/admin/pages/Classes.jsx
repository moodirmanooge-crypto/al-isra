import { useEffect, useMemo, useState } from "react";
import {
  collection,
  getDocs,
  doc,
  updateDoc,
  writeBatch,
} from "firebase/firestore";
import { db } from "../../firebase/firebase";
import Sidebar from "../components/Sidebar";
import Topbar from "../components/Topbar";
import {
  School,
  Users,
  ArrowLeft,
  Pencil,
  X,
  Save,
  Loader2,
  Search,
} from "lucide-react";

const classOptions = ["1", "2", "3", "4", "5", "6", "7", "8", "F1", "F2", "F3", "F4"];

export default function Classes() {
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const [selectedClass, setSelectedClass] = useState(null); // fasalka la furay
  const [renaming, setRenaming] = useState(null); // fasalka wax laga bedelayo
  const [newClassName, setNewClassName] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchStudents();
  }, []);

  async function fetchStudents() {
    try {
      setLoading(true);
      const snap = await getDocs(collection(db, "students"));
      setStudents(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    } catch (err) {
      console.log(err);
    } finally {
      setLoading(false);
    }
  }

  // ---- Isku duub ardayda class-kood, ku dar dhammaan class-yada
  // aan ardayna lahayn (0 arday) si liiska fasalada uu buuxo ----
  const classGroups = useMemo(() => {
    const groups = {};
    classOptions.forEach((c) => (groups[c] = []));

    students.forEach((s) => {
      const cls = s.className || "Unknown";
      if (!groups[cls]) groups[cls] = [];
      groups[cls].push(s);
    });

    return Object.entries(groups).sort((a, b) => a[0].localeCompare(b[0], undefined, { numeric: true }));
  }, [students]);

  const currentClassStudents = useMemo(() => {
    if (!selectedClass) return [];
    const list = students.filter((s) => (s.className || "Unknown") === selectedClass);
    const q = search.toLowerCase();
    if (!q) return list;
    return list.filter(
      (s) =>
        (s.fullName || "").toLowerCase().includes(q) ||
        (s.studentId || "").toLowerCase().includes(q)
    );
  }, [students, selectedClass, search]);

  // ---- Fur modal-ka "Edit Class" (u beddel magaca fasalka + dhammaan
  // ardayda ku jira, tusaale Class 7 -> Class 8) ----
  function openRename(className) {
    setRenaming(className);
    setNewClassName(className);
  }

  function closeRename() {
    setRenaming(null);
    setNewClassName("");
  }

  async function saveRename() {
    if (!newClassName.trim()) {
      alert("Fadlan dooro magaca fasalka cusub");
      return;
    }
    if (newClassName === renaming) {
      closeRename();
      return;
    }

    const affected = students.filter((s) => (s.className || "Unknown") === renaming);

    if (affected.length === 0) {
      closeRename();
      return;
    }

    try {
      setSaving(true);

      // ---- Isticmaal batch si dhammaan ardayda class-kaas loo
      // beddelo hal mar (si mid uusan ka soo hadhin) ----
      const batch = writeBatch(db);
      affected.forEach((student) => {
        batch.update(doc(db, "students", student.id), {
          className: newClassName,
        });
      });
      await batch.commit();

      setStudents((prev) =>
        prev.map((s) =>
          (s.className || "Unknown") === renaming
            ? { ...s, className: newClassName }
            : s
        )
      );

      alert(
        `${affected.length} arday ayaa laga bedelay Class ${renaming} una guuriyay Class ${newClassName}`
      );

      if (selectedClass === renaming) setSelectedClass(newClassName);
      closeRename();
    } catch (err) {
      console.log(err);
      alert(err.message);
    } finally {
      setSaving(false);
    }
  }

  // ---- Boggu marka fasal la furay (liiska ardayda) ----
  if (selectedClass) {
    return (
      <div style={{ display: "flex", minHeight: "100vh", background: "#0b0a1c" }}>
        <Sidebar />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ padding: "20px 24px 0" }}>
            <Topbar title="Classes" />
          </div>

          <div style={{ padding: "26px 30px" }}>
            <button onClick={() => setSelectedClass(null)} style={backBtn}>
              <ArrowLeft size={16} />
              Dib ugu noqo Fasalada
            </button>

            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginTop: 18,
                marginBottom: 22,
                flexWrap: "wrap",
                gap: 14,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                <div style={classIconBig}>
                  <School size={24} color="#8b6cf5" />
                </div>
                <div>
                  <h1 style={{ margin: 0, color: "#fff", fontSize: 24, fontWeight: 800 }}>
                    Class {selectedClass}
                  </h1>
                  <p style={{ margin: "3px 0 0", color: "#8b87ad", fontSize: 13 }}>
                    {currentClassStudents.length} arday oo ku jira fasalkan
                  </p>
                </div>
              </div>

              <button onClick={() => openRename(selectedClass)} style={editClassBtn}>
                <Pencil size={16} />
                Edit Class
              </button>
            </div>

            <div style={searchWrap}>
              <Search size={16} color="#8b87ad" />
              <input
                placeholder="Raadi arday magac ama ID..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                style={searchInput}
              />
            </div>

            <div style={listCard}>
              {currentClassStudents.length === 0 ? (
                <p style={{ color: "#8b87ad" }}>Wax arday ah kuma jiraan fasalkan.</p>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {currentClassStudents.map((s) => (
                    <div key={s.id} style={studentRow}>
                      <div
                        style={{
                          width: 42,
                          height: 42,
                          minWidth: 42,
                          borderRadius: "50%",
                          background: s.photoURL
                            ? `url(${s.photoURL}) center/cover`
                            : "linear-gradient(135deg,#6d5df0,#8b6cf5)",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          color: "#fff",
                          fontWeight: 700,
                          fontSize: 13,
                        }}
                      >
                        {!s.photoURL && (s.fullName || "?").slice(0, 2).toUpperCase()}
                      </div>

                      <div style={{ flex: 1, minWidth: 160 }}>
                        <div style={{ color: "#fff", fontWeight: 600, fontSize: 14 }}>
                          {s.fullName || "—"}
                        </div>
                        <div style={{ color: "#8b87ad", fontSize: 12, marginTop: 2 }}>
                          ID: {s.studentId || "—"}
                        </div>
                      </div>

                      <span style={tag}>{s.studentPhone || "—"}</span>
                      <span style={tag}>${s.monthlyFee || 0}/bishii</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {renaming && (
          <RenameModal
            renaming={renaming}
            newClassName={newClassName}
            setNewClassName={setNewClassName}
            saving={saving}
            onClose={closeRename}
            onSave={saveRename}
          />
        )}

        <style>{`
          input::placeholder { color: #6b6890; }
          select option { background: #1e1a4a; color: #ffffff; }
        `}</style>
      </div>
    );
  }

  // ---- Boggu marka aan wax fasal ah la furin (liiska fasalada oo dhan) ----
  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "#0b0a1c" }}>
      <Sidebar />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ padding: "20px 24px 0" }}>
          <Topbar title="Classes" />
        </div>

        <div style={{ padding: "26px 30px" }}>
          <h1 style={{ color: "#fff", marginBottom: 6, fontSize: 26, fontWeight: 800 }}>
            Classes
          </h1>
          <p style={{ color: "#8b87ad", marginBottom: 26, fontSize: 14 }}>
            Riix fasal si aad u aragto ardayda ku jira.
          </p>

          {loading ? (
            <p style={{ color: "#8b87ad" }}>Loading...</p>
          ) : (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
                gap: 18,
              }}
            >
              {classGroups.map(([className, list]) => (
                <div key={className} style={classCard}>
                  <div
                    onClick={() => {
                      setSelectedClass(className);
                      setSearch("");
                    }}
                    style={{ cursor: "pointer" }}
                  >
                    <div style={classIcon}>
                      <School size={22} color="#8b6cf5" />
                    </div>
                    <h3 style={{ color: "#fff", margin: "14px 0 4px", fontSize: 18 }}>
                      Class {className}
                    </h3>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, color: "#8b87ad", fontSize: 13 }}>
                      <Users size={14} />
                      {list.length} arday
                    </div>
                  </div>

                  <button
                    onClick={() => openRename(className)}
                    style={editClassBtnSmall}
                  >
                    <Pencil size={13} />
                    Edit
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {renaming && (
        <RenameModal
          renaming={renaming}
          newClassName={newClassName}
          setNewClassName={setNewClassName}
          saving={saving}
          onClose={closeRename}
          onSave={saveRename}
        />
      )}

      <style>{`
        input::placeholder { color: #6b6890; }
        select option { background: #1e1a4a; color: #ffffff; }
      `}</style>
    </div>
  );
}

// ---- Modal-ka wax-ka-bedelka magaca fasalka (tusaale Class 7 -> Class 8) ----
function RenameModal({ renaming, newClassName, setNewClassName, saving, onClose, onSave }) {
  return (
    <div style={overlay}>
      <div style={modal}>
        <div style={modalHeader}>
          <h2 style={{ color: "#fff", margin: 0, fontSize: 18 }}>
            Edit Class {renaming}
          </h2>
          <button onClick={onClose} style={closeBtn}>
            <X size={18} />
          </button>
        </div>

        <div style={{ padding: "22px 26px" }}>
          <label style={label}>Magaca Fasalka Cusub</label>
          <select
            style={input}
            value={newClassName}
            onChange={(e) => setNewClassName(e.target.value)}
          >
            {classOptions.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>

          <p style={{ color: "#8b87ad", fontSize: 12.5, marginTop: 14, lineHeight: 1.6 }}>
            Dhammaan ardayda hadda ku jira Class {renaming} ayaa si otomaatig ah
            loogu wareejin doonaa Class {newClassName}. Ardayda fasalada kale
            (attendance, exams, iwm) waxba kama bedelaan.
          </p>
        </div>

        <div style={modalFooter}>
          <button onClick={onClose} style={cancelBtn}>
            Iska daa
          </button>
          <button onClick={onSave} disabled={saving} style={saveBtn}>
            {saving ? (
              <>
                <Loader2 size={16} style={{ animation: "spin 1s linear infinite" }} />
                Kaydinaya...
              </>
            ) : (
              <>
                <Save size={16} />
                Kaydi
              </>
            )}
          </button>
        </div>
      </div>

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}

const backBtn = {
  display: "inline-flex",
  alignItems: "center",
  gap: 8,
  background: "rgba(255,255,255,0.03)",
  border: "1.5px solid rgba(139,108,245,0.3)",
  color: "#c4b5fd",
  padding: "9px 16px",
  borderRadius: 10,
  cursor: "pointer",
  fontWeight: 600,
  fontSize: 13,
};

const classIconBig = {
  width: 52,
  height: 52,
  minWidth: 52,
  borderRadius: 14,
  background: "rgba(139,108,245,0.12)",
  border: "1px solid rgba(139,108,245,0.3)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
};

const editClassBtn = {
  display: "inline-flex",
  alignItems: "center",
  gap: 8,
  background: "linear-gradient(90deg,#6d5df0,#8b6cf5)",
  color: "#fff",
  border: "none",
  padding: "11px 18px",
  borderRadius: 10,
  cursor: "pointer",
  fontWeight: 700,
  fontSize: 13.5,
  boxShadow: "0 8px 20px rgba(109,93,240,0.3)",
};

const editClassBtnSmall = {
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  background: "rgba(139,108,245,0.1)",
  border: "1px solid rgba(139,108,245,0.3)",
  color: "#c4b5fd",
  padding: "7px 12px",
  borderRadius: 8,
  cursor: "pointer",
  fontWeight: 600,
  fontSize: 12,
  marginTop: 14,
};

const searchWrap = {
  display: "flex",
  alignItems: "center",
  gap: 10,
  width: 320,
  padding: "0 14px",
  borderRadius: 10,
  border: "1.5px solid rgba(139,108,245,0.3)",
  background: "rgba(255,255,255,0.02)",
  marginBottom: 20,
};

const searchInput = {
  flex: 1,
  padding: "12px 0",
  border: "none",
  outline: "none",
  background: "transparent",
  color: "#e5e3f7",
  fontSize: 14,
};

const listCard = {
  background: "linear-gradient(160deg,#1c1840,#211c48)",
  borderRadius: 16,
  padding: 20,
  border: "1px solid rgba(255,255,255,0.05)",
};

const studentRow = {
  display: "flex",
  alignItems: "center",
  gap: 14,
  padding: "12px 14px",
  background: "rgba(255,255,255,0.02)",
  borderRadius: 12,
  border: "1px solid rgba(139,108,245,0.12)",
  flexWrap: "wrap",
};

const tag = {
  background: "rgba(139,108,245,0.12)",
  color: "#c4b5fd",
  fontSize: 12,
  padding: "6px 12px",
  borderRadius: 20,
  border: "1px solid rgba(139,108,245,0.25)",
  whiteSpace: "nowrap",
};

const classCard = {
  background: "linear-gradient(160deg,#1c1840,#211c48)",
  borderRadius: 16,
  padding: 20,
  border: "1px solid rgba(255,255,255,0.05)",
};

const classIcon = {
  width: 46,
  height: 46,
  borderRadius: 12,
  background: "rgba(139,108,245,0.12)",
  border: "1px solid rgba(139,108,245,0.3)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
};

const overlay = {
  position: "fixed",
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  background: "rgba(0,0,0,0.65)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  zIndex: 1000,
  padding: 20,
};

const modal = {
  background: "linear-gradient(160deg,#151233,#181341)",
  border: "1px solid rgba(139,108,245,0.3)",
  borderRadius: 18,
  width: "100%",
  maxWidth: 440,
};

const modalHeader = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  padding: "20px 24px",
  borderBottom: "1px solid rgba(139,108,245,0.2)",
};

const closeBtn = {
  background: "rgba(255,255,255,0.05)",
  border: "none",
  color: "#fff",
  width: 30,
  height: 30,
  borderRadius: 8,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  cursor: "pointer",
};

const modalFooter = {
  display: "flex",
  justifyContent: "flex-end",
  gap: 12,
  padding: "16px 24px",
  borderTop: "1px solid rgba(139,108,245,0.2)",
};

const cancelBtn = {
  background: "rgba(255,255,255,0.04)",
  border: "1.5px solid rgba(139,108,245,0.3)",
  color: "#fff",
  padding: "11px 20px",
  borderRadius: 10,
  cursor: "pointer",
  fontWeight: 600,
  fontSize: 13.5,
};

const saveBtn = {
  display: "inline-flex",
  alignItems: "center",
  gap: 8,
  background: "linear-gradient(90deg,#6d5df0,#8b6cf5)",
  color: "#fff",
  border: "none",
  padding: "11px 20px",
  borderRadius: 10,
  cursor: "pointer",
  fontWeight: 700,
  fontSize: 13.5,
};

const label = {
  display: "block",
  fontSize: 13.5,
  fontWeight: 600,
  color: "#fff",
  marginBottom: 8,
};

const input = {
  width: "100%",
  padding: "12px 14px",
  borderRadius: 10,
  border: "1.5px solid rgba(139,108,245,0.3)",
  boxSizing: "border-box",
  fontSize: 14,
  color: "#e5e3f7",
  background: "rgba(255,255,255,0.02)",
  outline: "none",
};