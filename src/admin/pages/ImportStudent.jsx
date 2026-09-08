import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { db } from "../../firebase/firebase";
import {
  doc,
  setDoc,
  collection,
  getDocs,
  updateDoc,
  arrayUnion,
} from "firebase/firestore";
import {
  Upload,
  CheckCircle2,
  ArrowRight,
  School,
  Loader2,
  Users,
  Clock,
} from "lucide-react";

const classOptions = [
  "Fasalka 1aad",
  "Fasalka 2aad",
  "Fasalka 3aad",
  "PP",
  "PI",
  "G8 A",
  "G8 B",
  "F1",
  "F2",
  "F3",
  "F4",
];

const normalizeClassName = (name) => name.trim().replace(/\s+/g, " ").toLowerCase();

// ---- Header-based column detection (for pasting straight from Excel) ----
// Maps every accepted header spelling to its internal field key. This lets
// the textarea accept EITHER the old fixed-order comma format, OR a direct
// paste from Excel (tab-separated, with a header row) in ANY column order.
const FIELD_ALIASES = {
  fullName: ["fullname", "full name", "name", "studentname", "student name"],
  motherName: ["mothername", "mother name", "mathername", "mather name", "mothersname"],
  placeOfBirth: ["placeofbirth", "place of birth", "birthplace", "pob"],
  dateOfBirth: ["dateofbirth", "date of birth", "dob", "birthdate", "date"],
  feeType: ["feetype", "fee type"],
  monthlyFee: ["monthlyfee", "monthly fee", "fee"],
  parentPhone: ["parentphone", "parent phone", "prentphone"],
  studentPhone: ["studentphone", "student phone"],
  district: ["district", "distiric", "distric"],
  previousSchool: ["previousschool", "previous school"],
  orphanStatus: ["orphanstatus", "orphan status"],
  parentPassword: ["parentpassword", "password"],
  feeCategory: ["feecategory", "fee category"],
  feeCategoryAmount: ["feecategoryamount", "fee category amount"],
};

const normalizeHeaderCell = (s) => (s || "").toLowerCase().replace(/[^a-z]/g, "");

const ALIAS_TO_FIELD = {};
Object.entries(FIELD_ALIASES).forEach(([field, aliases]) => {
  aliases.forEach((alias) => {
    ALIAS_TO_FIELD[normalizeHeaderCell(alias)] = field;
  });
});

function calculateAge(dateOfBirth) {
  if (!dateOfBirth) return "";
  const dob = new Date(dateOfBirth);
  if (Number.isNaN(dob.getTime())) return "";

  const today = new Date();
  let age = today.getFullYear() - dob.getFullYear();
  const monthDiff = today.getMonth() - dob.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) {
    age -= 1;
  }
  return age >= 0 ? String(age) : "";
}

export default function ImportStudent() {
  const navigate = useNavigate();

  // Class Selection
  const [selectedClass, setSelectedClass] = useState("");
  const [selectedShift, setSelectedShift] = useState("");
  const [selectedGender, setSelectedGender] = useState("");
  const [textInput, setTextInput] = useState("");

  const [showPopup, setShowPopup] = useState(false);
  const [savedStudents, setSavedStudents] = useState([]);
  const [saving, setSaving] = useState(false);
  const [customClasses, setCustomClasses] = useState([]);

  useEffect(() => {
    fetchCustomClasses();
  }, []);

  const fetchCustomClasses = async () => {
    try {
      const snap = await getDocs(collection(db, "customClasses"));
      setCustomClasses(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    } catch (err) {
      console.log(err);
    }
  };

  const allClassOptions = useMemo(() => {
    const customNames = customClasses
      .map((c) => c.name)
      .filter(
        (name) => !classOptions.some((c) => normalizeClassName(c) === normalizeClassName(name))
      )
      .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
    return [...classOptions, ...customNames];
  }, [customClasses]);

  const attachStudentToClassTeachers = async (
    teachersSnap,
    className,
    studentId,
    fullName
  ) => {
    for (const teacherDoc of teachersSnap.docs) {
      const data = teacherDoc.data();
      const teacherClasses = Array.isArray(data.classes) ? data.classes : [];

      const teachesThisClass = teacherClasses.some(
        (c) => c.className === className
      );

      if (teachesThisClass) {
        await updateDoc(doc(db, "teachers", teacherDoc.id), {
          students: arrayUnion({ studentId, fullName }),
        });
      }
    }
  };

  const parseAndValidateInput = () => {
    const rawLines = textInput
      .split("\n")
      .map((line) => line.replace(/\r$/, ""))
      .filter((line) => line.trim().length > 0);

    if (rawLines.length === 0) return [];

    // Excel paste uses tabs between columns; the classic manual format uses commas.
    const delimiter = rawLines[0].includes("\t") ? "\t" : ",";

    // Check if the first line is a header row (Excel column names) by matching
    // its cells against FIELD_ALIASES.
    const firstCells = rawLines[0].split(delimiter).map((c) => c.trim());
    const fieldIndexMap = {};
    firstCells.forEach((cell, idx) => {
      const key = ALIAS_TO_FIELD[normalizeHeaderCell(cell)];
      if (key && fieldIndexMap[key] === undefined) {
        fieldIndexMap[key] = idx;
      }
    });
    const hasHeader = fieldIndexMap.fullName !== undefined && fieldIndexMap.motherName !== undefined;

    const dataLines = hasHeader ? rawLines.slice(1) : rawLines;

    // Reads a field either by its header-mapped column (Excel paste) or by
    // its fixed legacy position (classic comma format).
    const getVal = (parts, field, legacyIndex) => {
      if (hasHeader) {
        const idx = fieldIndexMap[field];
        return idx !== undefined ? (parts[idx] || "").trim() : "";
      }
      return (parts[legacyIndex] || "").trim();
    };

    const parsed = [];

    for (let i = 0; i < dataLines.length; i++) {
      const lineNum = i + 1;
      const parts = dataLines[i].split(delimiter).map((p) => p.trim());

      const fullName = getVal(parts, "fullName", 0);
      const motherName = getVal(parts, "motherName", 1);
      const placeOfBirth = getVal(parts, "placeOfBirth", 3);
      const dateOfBirth = getVal(parts, "dateOfBirth", 4);
      const feeType = getVal(parts, "feeType", 6) || "Free";
      const monthlyFee = getVal(parts, "monthlyFee", 7) || "0";
      const parentPhone = getVal(parts, "parentPhone", 8);
      const studentPhone = getVal(parts, "studentPhone", 9);
      const district = getVal(parts, "district", 10);
      const previousSchool = getVal(parts, "previousSchool", 11);
      const orphanStatus = getVal(parts, "orphanStatus", 12) || "No";
      const parentPassword = getVal(parts, "parentPassword", 13);
      const feeCategory = getVal(parts, "feeCategory", 14);
      const feeCategoryAmount = getVal(parts, "feeCategoryAmount", 15) || "0";

      // Class, Shift, iyo Gender had iyo jeer waxaa laga qaataa doorashada kore
      // (sadexda qayb ee kor ku yaal). Haddii safku wax ku qorayo meelahaas,
      // waa la iska indho-tiraa oo lama isticmaalo.
      const shift = selectedShift;
      const gender = selectedGender;

      // --- VALIDATION FOR REQUIRED FIELDS ---
      if (!fullName) {
        alert(`Safka ${lineNum}: Magaca Ardayga (Full Name) waa ka dhiman yahay.`);
        return null;
      }
      if (!motherName) {
        alert(`Safka ${lineNum} (${fullName}): Magaca Hooyada (Mother Name) waa ka dhiman yahay.`);
        return null;
      }
      if (feeType === "Paid" && !monthlyFee) {
        alert(`Safka ${lineNum} (${fullName}): Monthly Fee waa ka dhiman yahay maadaama Fee Type uu yahay Paid.`);
        return null;
      }
      if (feeCategory && (!feeCategoryAmount || feeCategoryAmount === "0")) {
        alert(`Safka ${lineNum} (${fullName}): Qiimaha Fee Category (${feeCategory}) waa ka dhiman yahay.`);
        return null;
      }

      parsed.push({
        fullName,
        motherName,
        gender,
        placeOfBirth,
        dateOfBirth,
        shift,
        feeType,
        monthlyFee: feeType === "Free" ? "0" : monthlyFee,
        parentPhone,
        studentPhone,
        district,
        previousSchool,
        orphanStatus,
        parentPassword,
        feeCategory,
        feeCategoryAmount,
      });
    }

    return parsed;
  };

  const saveStudents = async () => {
    if (!selectedClass) {
      alert("Fadlan marka hore dooro Class / Department-ka.");
      return;
    }

    if (!selectedShift) {
      alert("Fadlan dooro Shift-ka (Morning ama Afternoon).");
      return;
    }

    if (!selectedGender) {
      alert("Fadlan dooro Gender-ka (Male ama Female).");
      return;
    }

    if (!textInput.trim()) {
      alert("Fadlan geli ugu yaraan hal xariiq oo xogta ardayda ah.");
      return;
    }

    const parsedList = parseAndValidateInput();
    if (!parsedList) return; // Validation failed

    try {
      setSaving(true);
      const saved = [];

      const existingSnap = await getDocs(collection(db, "students"));
      let nextIdNumber = existingSnap.size;
      const teachersSnap = await getDocs(collection(db, "teachers"));

      for (let i = 0; i < parsedList.length; i++) {
        const student = parsedList[i];

        nextIdNumber += 1;
        const studentId = String(nextIdNumber).padStart(4, "0");
        const finalAge = calculateAge(student.dateOfBirth);

        const registrationFees =
          student.feeCategory === "Registration Fees" ? student.feeCategoryAmount : "0";
        const rollNumberFees =
          student.feeCategory === "Roll Number Fees" ? student.feeCategoryAmount : "0";
        const examinationFees =
          student.feeCategory === "Examination Fees" ? student.feeCategoryAmount : "0";

        // 1. Save to `students`
        await setDoc(doc(db, "students", studentId), {
          studentId,
          fullName: student.fullName,
          motherName: student.motherName,
          gender: student.gender,
          placeOfBirth: student.placeOfBirth,
          dateOfBirth: student.dateOfBirth,
          age: finalAge,
          className: selectedClass,
          shift: student.shift,
          feeType: student.feeType,
          monthlyFee: student.monthlyFee,
          feeCategory: student.feeCategory,
          registrationFees,
          rollNumberFees,
          examinationFees,
          parentPhone: student.parentPhone,
          studentPhone: student.studentPhone,
          district: student.district,
          previousSchool: student.previousSchool,
          orphanStatus: student.orphanStatus,
          parentPassword: student.parentPassword,
          studentPhoto: "",
          createdAt: new Date(),
        });

        // 2. Save to `attendance`
        await setDoc(doc(db, "attendance", studentId), {
          studentId,
          studentName: student.fullName,
        });

        // 3. Save to `cashier`
        await setDoc(doc(db, "cashier", studentId), {
          studentId,
          studentName: student.fullName,
          studentPhone: student.studentPhone,
          parentPhone: student.parentPhone,
          feeType: student.feeType,
          monthlyFee: student.monthlyFee,
          feeCategory: student.feeCategory,
          registrationFees,
          rollNumberFees,
          examinationFees,
        });

        // 4. Save to `studentIdCards`
        await setDoc(doc(db, "studentIdCards", studentId), {
          studentId,
          fullName: student.fullName,
          motherName: student.motherName,
          gender: student.gender,
          placeOfBirth: student.placeOfBirth,
          dateOfBirth: student.dateOfBirth,
          age: finalAge,
          className: selectedClass,
          shift: student.shift,
          studentPhoto: "",
          district: student.district,
          parentPhone: student.parentPhone,
          studentPhone: student.studentPhone,
          idIssuedAt: new Date(),
          issuedAt: new Date(),
          createdAt: new Date(),
        });

        // 5. Attach to teachers
        await attachStudentToClassTeachers(
          teachersSnap,
          selectedClass,
          studentId,
          student.fullName
        );

        saved.push({
          ...student,
          studentId,
        });
      }

      setSavedStudents(saved);
      setShowPopup(true);
      setTextInput("");
    } catch (err) {
      console.log(err);
      alert(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ background: "#0b0a1c", minHeight: "100vh", padding: "30px", color: "#e5e3f7" }}>
      <div style={{ maxWidth: 1050, margin: "0 auto" }}>
        {/* Header */}
        <div style={{ marginBottom: 24 }}>
          <h1 style={{ margin: 0, fontSize: 28, fontWeight: 800, color: "#fff" }}>
            Import Students
          </h1>
          <p style={{ margin: "6px 0 0", color: "#8b87ad", fontSize: 14 }}>
            Bulk import multi-students into a selected Class/Department.
          </p>
        </div>

        {/* Tab / Mode Bar */}
        <div style={{ display: "flex", gap: 12, marginBottom: 24 }}>
          <button
            onClick={() => navigate("/admin/add-student")}
            style={inactiveTabBtn}
          >
            Hal Student
          </button>
          <button style={activeTabBtn}>
            <Upload size={16} />
            Diiwaan-gelin Badan (Import)
          </button>
        </div>

        {/* Main Form Container */}
        <div
          style={{
            background: "linear-gradient(160deg,#151233,#181341)",
            borderRadius: 20,
            padding: "32px",
            border: "1px solid rgba(139,108,245,0.25)",
            boxShadow: "0 10px 30px rgba(0,0,0,0.3)",
          }}
        >
          {/* Class / Shift / Gender Selection */}
          <div style={{ marginBottom: 24, display: "flex", gap: 16, flexWrap: "wrap" }}>
            <div style={{ flex: "1 1 240px" }}>
              <label style={labelStyle}>
                <School size={18} color="#8b6cf5" />
                Dooro Class / Department (Waajib):
              </label>
              <select
                style={selectStyle}
                value={selectedClass}
                onChange={(e) => setSelectedClass(e.target.value)}
              >
                <option value="">-- Dooro Class --</option>
                {allClassOptions.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>

            <div style={{ flex: "1 1 200px" }}>
              <label style={labelStyle}>
                <Clock size={18} color="#8b6cf5" />
                Dooro Shift (Waajib):
              </label>
              <select
                style={selectStyle}
                value={selectedShift}
                onChange={(e) => setSelectedShift(e.target.value)}
              >
                <option value="">-- Dooro Shift --</option>
                <option value="Morning">Morning</option>
                <option value="Afternoon">Afternoon</option>
              </select>
            </div>

            <div style={{ flex: "1 1 200px" }}>
              <label style={labelStyle}>
                <Users size={18} color="#8b6cf5" />
                Dooro Gender (Waajib):
              </label>
              <select
                style={selectStyle}
                value={selectedGender}
                onChange={(e) => setSelectedGender(e.target.value)}
              >
                <option value="">-- Dooro Gender --</option>
                <option value="Male">Male</option>
                <option value="Female">Female</option>
              </select>
            </div>
          </div>

          {/* Guidelines */}
          <div
            style={{
              background: "rgba(139,108,245,0.08)",
              border: "1px solid rgba(139,108,245,0.2)",
              borderRadius: 12,
              padding: "16px",
              marginBottom: 20,
              fontSize: 13,
              lineHeight: "1.6",
            }}
          >
            <strong style={{ color: "#fff" }}>Laba hab oo xogta loo geli karo:</strong>
            <div style={{ marginTop: 8, color: "#8b87ad" }}>
              <strong style={{ color: "#e5e3f7" }}>1) Excel Paste (ugu fudud):</strong> Excel-ka xogta ka koobiyee (copy) oo halkan ku dheji (paste) — si toos ah. Safka koowaad (row 1) ha ka kooban yahay magacyada column-ka (tusaale: FullName, MotherName, District, DateOfBirth, StudentPhone, ParentPhone, iwm). Nidaamka (order) ee tiirarku dani ma leh — system-ku wuxuu magaca column-ka ku ogaanayaa meesha saxda ah.
            </div>
            <div style={{ marginTop: 8, color: "#8b87ad" }}>
              <strong style={{ color: "#e5e3f7" }}>2) Qoraal gacanta (comma):</strong> Hal xariiq = hal arday, oo field-yada la kala saaro comma (,) — sida kala-horreynta hoose:
            </div>
            <div
              style={{
                fontFamily: "monospace",
                color: "#a78bfa",
                marginTop: 6,
                wordBreak: "break-all",
              }}
            >
              FullName, MotherName, Gender, PlaceOfBirth, DateOfBirth, Shift, FeeType, MonthlyFee, ParentPhone, StudentPhone, District, PreviousSchool, OrphanStatus, ParentPassword, FeeCategory, FeeCategoryAmount
            </div>
            <div style={{ marginTop: 8, color: "#8b87ad" }}>
              * <strong>Waajib:</strong> FullName, MotherName.<br/>
              * <strong>Class, Shift &amp; Gender:</strong> Had iyo jeer waxaa laga qaataa doorashada kore (sadexda qayb ee kor ku yaal). Haddii safka lagu qoro qiyam kale, si toos ah ayaa loo iska indho-tiraa.<br/>
              * <strong>Ikhtiyaari:</strong> Qeybaha kale waa la iska dhaafi karaan adoo komaha (,) reebaya.
            </div>
          </div>

          {/* Textarea Bulk Input */}
          <textarea
            rows={10}
            style={textareaStyle}
            placeholder={`Amina Abdi, Faadumo Ali, Female, Mogadishu, 2005-04-12, Morning, Free, 0, 615000000, 616000000, Hodan, Banadir, No, pass123\nMohamed Hassan, Asha Omar, Male, Hargeisa, 2003-08-20, Afternoon, Paid, 15, 615111111, , Hawlwadaag, , No, pass456`}
            value={textInput}
            onChange={(e) => setTextInput(e.target.value)}
          />

          {/* Submit Button */}
          <div style={{ marginTop: 24, textAlign: "right" }}>
            <button
              onClick={saveStudents}
              disabled={saving}
              style={{
                ...btnPrimary,
                opacity: saving ? 0.7 : 1,
                cursor: saving ? "not-allowed" : "pointer",
              }}
            >
              {saving ? (
                <>
                  <Loader2 size={18} style={{ animation: "spin 1s linear infinite" }} />
                  Kaydinaya...
                </>
              ) : (
                <>
                  <Upload size={18} />
                  Import Dhammaan Ardayda
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Success Modal */}
      {showPopup && (
        <div style={popupOverlay}>
          <div style={popupCard}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
              <div
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: "50%",
                  background: "rgba(34,197,94,0.15)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <CheckCircle2 color="#4ade80" size={24} />
              </div>
              <div>
                <h2 style={{ color: "#fff", margin: 0, fontSize: 18, fontWeight: 700 }}>
                  Import Completed Successfully!
                </h2>
                <p style={{ margin: 0, color: "#8b87ad", fontSize: 13 }}>
                  Diiwaan-gelinta {savedStudents.length} arday waa la dhameystiray.
                </p>
              </div>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 8, maxHeight: 260, overflowY: "auto" }}>
              {savedStudents.map((st) => (
                <div
                  key={st.studentId}
                  style={{
                    background: "rgba(255,255,255,0.03)",
                    borderRadius: 10,
                    padding: "10px 14px",
                    border: "1px solid rgba(139,108,245,0.15)",
                  }}
                >
                  <div style={{ color: "#fff", fontWeight: 600, fontSize: 14 }}>
                    {st.fullName}
                  </div>
                  <div style={{ color: "#8b87ad", fontSize: 12.5, marginTop: 2 }}>
                    ID: <strong style={{ color: "#a78bfa" }}>{st.studentId}</strong> · {selectedClass} · {st.shift}
                  </div>
                </div>
              ))}
            </div>

            <button
              onClick={() => {
                setShowPopup(false);
                setSavedStudents([]);
                navigate("/admin/students");
              }}
              style={{ ...btnPrimary, width: "100%", marginTop: 20, justifyContent: "center" }}
            >
              U gudub Students List
              <ArrowRight size={17} />
            </button>
          </div>
        </div>
      )}

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        select option {
          background: #181341;
          color: #ffffff;
        }
      `}</style>
    </div>
  );
}

// Styling
const labelStyle = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  fontWeight: 600,
  marginBottom: 10,
  color: "#fff",
  fontSize: 15,
};

const selectStyle = {
  width: "100%",
  padding: "14px 16px",
  boxSizing: "border-box",
  border: "1.5px solid rgba(139,108,245,0.35)",
  borderRadius: 12,
  fontSize: 14.5,
  color: "#e5e3f7",
  outline: "none",
  background: "rgba(255,255,255,0.02)",
};

const textareaStyle = {
  width: "100%",
  padding: "16px",
  borderRadius: 12,
  border: "1.5px solid rgba(139,108,245,0.35)",
  background: "rgba(255,255,255,0.02)",
  color: "#e5e3f7",
  fontSize: 14,
  fontFamily: "monospace",
  lineHeight: 1.6,
  outline: "none",
  boxSizing: "border-box",
  resize: "vertical",
};

const activeTabBtn = {
  display: "inline-flex",
  alignItems: "center",
  gap: 8,
  background: "linear-gradient(90deg,#6d5df0,#8b6cf5)",
  color: "#ffffff",
  border: "none",
  padding: "10px 20px",
  borderRadius: 10,
  fontWeight: 600,
  fontSize: 14,
  cursor: "pointer",
};

const inactiveTabBtn = {
  display: "inline-flex",
  alignItems: "center",
  gap: 8,
  background: "rgba(255,255,255,0.05)",
  color: "#8b87ad",
  border: "1px solid rgba(139,108,245,0.2)",
  padding: "10px 20px",
  borderRadius: 10,
  fontWeight: 600,
  fontSize: 14,
  cursor: "pointer",
};

const btnPrimary = {
  display: "inline-flex",
  alignItems: "center",
  gap: 10,
  background: "linear-gradient(90deg,#6d5df0,#8b6cf5)",
  color: "#ffffff",
  border: "none",
  borderRadius: 12,
  padding: "14px 26px",
  fontWeight: 700,
  fontSize: 15,
  boxShadow: "0 8px 20px rgba(109,93,240,0.35)",
};

const popupOverlay = {
  position: "fixed",
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  background: "rgba(11,10,28,0.85)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  zIndex: 1000,
};

const popupCard = {
  background: "#151233",
  border: "1px solid rgba(139,108,245,0.3)",
  borderRadius: 20,
  padding: 28,
  minWidth: 380,
  maxWidth: 500,
  boxShadow: "0 20px 40px rgba(0, 0, 0, 0.5)",
};