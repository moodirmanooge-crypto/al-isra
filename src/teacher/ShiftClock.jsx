// src/teacher/ShiftClock.jsx
// Lets a teacher clock a shift in/out for the day and keeps a full
// history of every shift ever worked, saved to Firestore under
// "shifts" (one document per shift, so nothing is ever overwritten).
//
// NOTE: Live-ticking timer-ka (second-by-second) waa la saaray.
// Marka shiftka furan yahay, waxaa kaliya la tusayaa in uu furan yahay
// iyo waqtiga uu ka bilaabmay — muddada (duration) lama xisaabiyo
// ilaa uu shiftka xirmo. Marka la xiro, muddadii saxda ah ayaa la
// keydiyaa oo lagu tusaa History-ga.
import { useEffect, useState } from "react";
import { db } from "../firebase/firebase";
import {
  collection,
  addDoc,
  updateDoc,
  doc,
  getDocs,
  query,
  where,
  orderBy,
  serverTimestamp,
} from "firebase/firestore";
import { Clock, LogIn, LogOut, History, X } from "lucide-react";

function ShiftClockStyles() {
  return (
    <style>{`
      .sc-card {
        background: #0B1120;
        border: 1px solid rgba(255,255,255,.06);
        border-radius: 20px;
        padding: 24px;
        margin-bottom: 24px;
      }
      .sc-header-row {
        display: flex;
        justify-content: space-between;
        align-items: center;
        flex-wrap: wrap;
        gap: 10px;
        margin-bottom: 16px;
      }
      .sc-status-row {
        display: flex;
        align-items: center;
        gap: 14px;
        flex-wrap: wrap;
      }
      .sc-btn-row { display: flex; gap: 10px; flex-wrap: wrap; margin-top: 16px; }

      .sc-modal-overlay {
        position: fixed; inset: 0; background: rgba(0,0,0,.6);
        display: flex; align-items: center; justify-content: center;
        z-index: 2000; padding: 16px; box-sizing: border-box;
      }
      .sc-modal {
        background: #0B1120; border: 1px solid rgba(255,255,255,.08);
        border-radius: 20px; padding: 24px; width: min(520px, 92vw);
        max-height: 80vh; overflow-y: auto; box-sizing: border-box;
      }
      .sc-history-row {
        display: flex; justify-content: space-between; align-items: center;
        gap: 10px; padding: 12px 14px; border-radius: 12px;
        background: #111827; border: 1px solid rgba(255,255,255,.06);
        margin-bottom: 8px; flex-wrap: wrap;
      }

      @media (max-width: 900px) {
        .sc-card { padding: 16px !important; border-radius: 16px !important; }
        .sc-btn-row button { flex: 1 1 45%; justify-content: center; }
        .sc-modal { padding: 18px; width: 100%; }
      }

      @media (max-width: 480px) {
        .sc-btn-row button { flex: 1 1 100%; }
      }
    `}</style>
  );
}

// Muddada waxaa loo qaabeeyaa "Xh Xd" (saacado iyo daqiiqado) —
// kaliya waqtiga la xiray ayaa loo isticmaalaa, ma aha mid live-ah.
function formatDuration(ms) {
  if (!ms || ms < 0) ms = 0;
  const totalMinutes = Math.floor(ms / 60000);
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return `${h}s ${m}d`;
}

function toDateSafe(v) {
  if (!v) return null;
  return v.toDate ? v.toDate() : new Date(v);
}

function formatDateTime(v) {
  const d = toDateSafe(v);
  return d ? d.toLocaleString() : "—";
}

// Waqtiga oo kaliya (saacad:daqiiqad) — waxaa loo isticmaalaa
// bogga History si loo tuso goorma shiftka la xiray.
function formatTimeOnly(v) {
  const d = toDateSafe(v);
  return d
    ? d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    : "—";
}

export default function ShiftClock() {
  const teacherId = localStorage.getItem("teacherId") || "";
  const teacherName = localStorage.getItem("teacherName") || "Teacher";

  const [activeShift, setActiveShift] = useState(null); // { id, clockInAt }
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const [showHistory, setShowHistory] = useState(false);
  const [history, setHistory] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  useEffect(() => {
    loadActiveShift();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Look in Firestore (not local state) for any shift this teacher has
  // clocked in but not yet clocked out. This is what makes the open
  // shift survive a page refresh or switching devices.
  const loadActiveShift = async () => {
    try {
      setLoading(true);
      if (!teacherId) {
        setLoading(false);
        return;
      }

      const snap = await getDocs(
        query(
          collection(db, "shifts"),
          where("teacherId", "==", teacherId),
          where("status", "==", "open")
        )
      );

      if (!snap.empty) {
        const d = snap.docs[0];
        const data = d.data();
        setActiveShift({
          id: d.id,
          clockInAt: toDateSafe(data.clockInAt) || new Date(),
        });
      } else {
        setActiveShift(null);
      }
    } catch (err) {
      console.log(err);
    } finally {
      setLoading(false);
    }
  };

  const loadHistory = async () => {
    try {
      setLoadingHistory(true);
      const snap = await getDocs(
        query(
          collection(db, "shifts"),
          where("teacherId", "==", teacherId),
          orderBy("clockInAt", "desc")
        )
      );
      setHistory(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    } catch (err) {
      console.log(err);
      // Firestore needs a composite index for where+orderBy on first use;
      // fall back to unsorted so the teacher still sees their history.
      try {
        const snap2 = await getDocs(
          query(collection(db, "shifts"), where("teacherId", "==", teacherId))
        );
        const list = snap2.docs.map((d) => ({ id: d.id, ...d.data() }));
        list.sort((a, b) => {
          const at = toDateSafe(a.clockInAt)?.getTime() || 0;
          const bt = toDateSafe(b.clockInAt)?.getTime() || 0;
          return bt - at;
        });
        setHistory(list);
      } catch (err2) {
        console.log(err2);
      }
    } finally {
      setLoadingHistory(false);
    }
  };

  const openHistory = () => {
    setShowHistory(true);
    loadHistory();
  };

  const clockIn = async () => {
    if (!teacherId) {
      alert("Teacher ID lama helin. Fadlan mar labaad soo gal.");
      return;
    }
    try {
      setBusy(true);
      const clockInAt = new Date();
      const docRef = await addDoc(collection(db, "shifts"), {
        teacherId,
        teacherName,
        clockInAt,
        clockOutAt: null,
        durationMs: null,
        status: "open",
        createdAt: serverTimestamp(),
      });
      setActiveShift({ id: docRef.id, clockInAt });
    } catch (err) {
      console.log(err);
      alert(err.message);
    } finally {
      setBusy(false);
    }
  };

  const clockOut = async () => {
    if (!activeShift) return;
    try {
      setBusy(true);
      const clockOutAt = new Date();
      const durationMs = clockOutAt.getTime() - activeShift.clockInAt.getTime();

      await updateDoc(doc(db, "shifts", activeShift.id), {
        clockOutAt,
        durationMs,
        status: "closed",
      });

      setActiveShift(null);
      alert(
        `Shiftka waa la xiray. Wakhtiga la shaqeeyay: ${formatDuration(
          durationMs
        )}`
      );
    } catch (err) {
      console.log(err);
      alert(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="sc-card">
      <ShiftClockStyles />

      <div className="sc-header-row">
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div
            style={{
              width: 40,
              height: 40,
              borderRadius: "50%",
              background: "rgba(139,92,246,0.15)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            <Clock size={20} color="#8B5CF6" />
          </div>
          <h3 style={{ margin: 0, color: "#fff" }}>My Shift</h3>
        </div>

        <button onClick={openHistory} style={btnHistory}>
          <History size={15} style={{ marginRight: 6 }} />
          Shift History
        </button>
      </div>

      {loading ? (
        <p style={{ color: "#94A3B8", margin: 0 }}>Loading shift status...</p>
      ) : activeShift ? (
        <>
          <div className="sc-status-row">
            <span
              style={{
                background: "rgba(34,197,94,0.15)",
                color: "#22C55E",
                padding: "4px 12px",
                borderRadius: 20,
                fontWeight: 700,
                fontSize: 13,
              }}
            >
              ● Shiftka waa furan yahay
            </span>
            <span style={{ color: "#94A3B8", fontSize: 13 }}>
              La bilaabay: {formatDateTime(activeShift.clockInAt)}
            </span>
          </div>

          <div className="sc-btn-row">
            <button onClick={clockOut} disabled={busy} style={btnDanger}>
              <LogOut size={16} style={{ marginRight: 8 }} />
              {busy ? "Xirayaa..." : "Xir Shiftka (Clock Out)"}
            </button>
          </div>
        </>
      ) : (
        <>
          <div className="sc-status-row">
            <span
              style={{
                background: "rgba(148,163,184,0.15)",
                color: "#94A3B8",
                padding: "4px 12px",
                borderRadius: 20,
                fontWeight: 700,
                fontSize: 13,
              }}
            >
              ● Shift furan ma jiro
            </span>
          </div>

          <div className="sc-btn-row">
            <button onClick={clockIn} disabled={busy} style={btnPrimary}>
              <LogIn size={16} style={{ marginRight: 8 }} />
              {busy ? "Furayaa..." : "Fur Shiftka (Clock In)"}
            </button>
          </div>
        </>
      )}

      {/* ---- History modal ---- */}
      {showHistory && (
        <div
          className="sc-modal-overlay"
          onClick={() => setShowHistory(false)}
        >
          <div className="sc-modal" onClick={(e) => e.stopPropagation()}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 16,
              }}
            >
              <h3 style={{ margin: 0, color: "#fff" }}>Taariikhda Shiftiyada</h3>
              <button
                onClick={() => setShowHistory(false)}
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

            {loadingHistory ? (
              <p style={{ color: "#94A3B8" }}>Loading...</p>
            ) : history.length === 0 ? (
              <p style={{ color: "#94A3B8" }}>Weli shift lama furin.</p>
            ) : (
              history.map((s) => {
                const isOpen = s.status === "open";
                // Muddada shiftyada xiran waxaa laga soo qaatay
                // durationMs-ka la keydiyay markii la xiray — kani waa
                // qiimaha ugu saxsan, mana isbedelo mar dambe.
                const dur = isOpen ? null : s.durationMs || 0;
                return (
                  <div key={s.id} className="sc-history-row">
                    <div style={{ minWidth: 0 }}>
                      <div style={{ color: "#fff", fontWeight: 600, fontSize: 14 }}>
                        {formatDateTime(s.clockInAt)}
                        {" → "}
                        {isOpen ? "Weli furan" : formatTimeOnly(s.clockOutAt)}
                      </div>
                      <div style={{ color: "#94A3B8", fontSize: 12.5, marginTop: 2 }}>
                        {isOpen
                          ? "Wali lama xirin"
                          : `Muddo: ${formatDuration(dur)}`}
                      </div>
                    </div>
                    <span
                      style={{
                        background: isOpen
                          ? "rgba(34,197,94,0.15)"
                          : "rgba(109,93,240,0.15)",
                        color: isOpen ? "#22C55E" : "#8B5CF6",
                        padding: "4px 10px",
                        borderRadius: 20,
                        fontWeight: 700,
                        fontSize: 12,
                        flexShrink: 0,
                      }}
                    >
                      {isOpen ? "Furan" : "Xiran"}
                    </span>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}

const btnPrimary = {
  background: "linear-gradient(90deg,#6D5DF0,#8B5CF6)",
  color: "white",
  border: "none",
  borderRadius: 10,
  padding: "12px 22px",
  cursor: "pointer",
  fontWeight: "bold",
  fontSize: 14,
  display: "inline-flex",
  alignItems: "center",
};
const btnDanger = {
  background: "#EF4444",
  color: "white",
  border: "none",
  borderRadius: 10,
  padding: "12px 22px",
  cursor: "pointer",
  fontWeight: "bold",
  fontSize: 14,
  display: "inline-flex",
  alignItems: "center",
};
const btnHistory = {
  background: "none",
  border: "1px solid rgba(139,92,246,.4)",
  color: "#8B5CF6",
  cursor: "pointer",
  fontSize: 13,
  fontWeight: "bold",
  borderRadius: 10,
  padding: "8px 16px",
  display: "inline-flex",
  alignItems: "center",
};