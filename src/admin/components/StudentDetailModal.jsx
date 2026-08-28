import { useState, useEffect } from "react";
import { db } from "../../firebase/firebase";
import { doc, updateDoc } from "firebase/firestore";

// ---- Field-yada la muujin karo/edit gareyn karo (ID lagama beddeli karo) ----
const EDITABLE_FIELDS = [
  { key: "fullName", label: "Full Name", type: "text" },
  { key: "className", label: "Class Name", type: "text" },
  { key: "monthlyFee", label: "Monthly Fee ($)", type: "number" },
  { key: "parentPhone", label: "Parent Phone", type: "text" },
  { key: "studentPhone", label: "Student Phone", type: "text" },
  { key: "district", label: "District", type: "text" },
  { key: "previousSchool", label: "Previous School", type: "text" },
  {
    key: "orphanStatus",
    label: "Orphan Status",
    type: "select",
    options: ["No", "Yes"],
  },
];

export default function StudentDetailModal({ student, onClose, onUpdated }) {
  const [editMode, setEditMode] = useState(false);
  const [formData, setFormData] = useState({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (student) {
      setFormData({ ...student });
      setEditMode(false);
      setError("");
    }
  }, [student]);

  if (!student) return null;

  function handleChange(key, value) {
    setFormData((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSave() {
    try {
      setSaving(true);
      setError("");

      // ID-ga marnaba lama beddelo, waa la reebaa
      const { id, ...updateData } = formData;

      const studentRef = doc(db, "students", student.id);
      await updateDoc(studentRef, updateData);

      if (onUpdated) {
        onUpdated({ id: student.id, ...updateData });
      }
      setEditMode(false);
    } catch (err) {
      console.error("Khalad ayaa dhacay marka la kaydinayay:", err);
      setError("Khalad ayaa dhacay marka xogta la kaydinayo. Fadlan isku day mar kale.");
    } finally {
      setSaving(false);
    }
  }

  function handleCancel() {
    setFormData({ ...student });
    setEditMode(false);
    setError("");
  }

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(15, 23, 42, 0.55)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
        padding: "20px",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "#fff",
          borderRadius: "20px",
          width: "100%",
          maxWidth: "760px",
          maxHeight: "90vh",
          overflowY: "auto",
          boxShadow: "0 20px 60px rgba(0,0,0,.25)",
        }}
      >
        {/* ---- Header ---- */}
        <div
          style={{
            background: "linear-gradient(135deg, #6366f1, #4f46e5)",
            borderTopLeftRadius: "20px",
            borderTopRightRadius: "20px",
            padding: "24px 28px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            color: "#fff",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
            <div
              style={{
                width: "64px",
                height: "64px",
                borderRadius: "16px",
                overflow: "hidden",
                background: "rgba(255,255,255,0.2)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
                fontSize: "26px",
                fontWeight: 700,
              }}
            >
              {student.photoUrl ? (
                <img
                  src={student.photoUrl}
                  alt={student.fullName}
                  style={{ width: "100%", height: "100%", objectFit: "cover" }}
                />
              ) : (
                (student.fullName || "?").charAt(0).toUpperCase()
              )}
            </div>
            <div>
              <h2 style={{ margin: 0, fontSize: "22px", fontWeight: 700 }}>
                {student.fullName || "—"}
              </h2>
              <p style={{ margin: "4px 0 0", opacity: 0.9, fontSize: "14px" }}>
                ID: {student.studentId || student.id}
                {student.className ? `  •  Class ${student.className}` : ""}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            style={{
              background: "rgba(255,255,255,0.2)",
              border: "none",
              color: "#fff",
              width: "34px",
              height: "34px",
              borderRadius: "10px",
              fontSize: "18px",
              cursor: "pointer",
              lineHeight: 1,
            }}
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {/* ---- Body ---- */}
        <div style={{ padding: "28px" }}>
          {error && (
            <div
              style={{
                background: "#fee2e2",
                color: "#b91c1c",
                padding: "10px 14px",
                borderRadius: "10px",
                marginBottom: "18px",
                fontSize: "14px",
              }}
            >
              {error}
            </div>
          )}

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(2, 1fr)",
              gap: "18px 24px",
            }}
          >
            {EDITABLE_FIELDS.map((field) => (
              <div key={field.key}>
                <label
                  style={{
                    display: "block",
                    fontSize: "13px",
                    fontWeight: 600,
                    color: "#374151",
                    marginBottom: "6px",
                  }}
                >
                  {field.label}
                </label>

                {editMode ? (
                  field.type === "select" ? (
                    <select
                      value={formData[field.key] ?? ""}
                      onChange={(e) => handleChange(field.key, e.target.value)}
                      style={inputStyle}
                    >
                      {field.options.map((opt) => (
                        <option key={opt} value={opt}>
                          {opt}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type={field.type}
                      value={formData[field.key] ?? ""}
                      onChange={(e) => handleChange(field.key, e.target.value)}
                      style={inputStyle}
                    />
                  )
                ) : (
                  <div
                    style={{
                      padding: "10px 14px",
                      background: "#f8fafc",
                      borderRadius: "10px",
                      color: "#111827",
                      fontSize: "14px",
                      minHeight: "20px",
                    }}
                  >
                    {field.key === "monthlyFee" && formData[field.key]
                      ? `$${formData[field.key]}`
                      : formData[field.key] || "—"}
                  </div>
                )}
              </div>
            ))}

            {/* ---- ID-ga: Read-only oo kaliya ---- */}
            <div>
              <label
                style={{
                  display: "block",
                  fontSize: "13px",
                  fontWeight: 600,
                  color: "#374151",
                  marginBottom: "6px",
                }}
              >
                Student ID
              </label>
              <div
                style={{
                  padding: "10px 14px",
                  background: "#eef2ff",
                  borderRadius: "10px",
                  color: "#4338ca",
                  fontSize: "14px",
                  fontWeight: 600,
                }}
              >
                {student.studentId || student.id}
              </div>
            </div>
          </div>

          {/* ---- Buttons ---- */}
          <div
            style={{
              display: "flex",
              justifyContent: "flex-end",
              gap: "12px",
              marginTop: "28px",
            }}
          >
            {editMode ? (
              <>
                <button
                  onClick={handleCancel}
                  disabled={saving}
                  style={secondaryBtnStyle}
                >
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  style={primaryBtnStyle}
                >
                  {saving ? "Saving..." : "Save Changes"}
                </button>
              </>
            ) : (
              <>
                <button onClick={onClose} style={secondaryBtnStyle}>
                  Close
                </button>
                <button onClick={() => setEditMode(true)} style={primaryBtnStyle}>
                  ✏️ Edit Student
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

const inputStyle = {
  width: "100%",
  padding: "10px 14px",
  borderRadius: "10px",
  border: "1px solid #e2e8f0",
  fontSize: "14px",
  outline: "none",
  boxSizing: "border-box",
};

const primaryBtnStyle = {
  background: "linear-gradient(135deg, #6366f1, #4f46e5)",
  color: "#fff",
  border: "none",
  padding: "11px 22px",
  borderRadius: "10px",
  fontSize: "14px",
  fontWeight: 600,
  cursor: "pointer",
};

const secondaryBtnStyle = {
  background: "#f1f5f9",
  color: "#334155",
  border: "none",
  padding: "11px 22px",
  borderRadius: "10px",
  fontSize: "14px",
  fontWeight: 600,
  cursor: "pointer",
};