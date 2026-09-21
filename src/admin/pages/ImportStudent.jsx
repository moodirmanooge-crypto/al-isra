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

// ✅ Import-ka Logo-da Iskuulka — waxaa loo isticmaalayaa sawir default ah
// maadaama Import-ka aan la soo shubin sawir gaar ah arday kasta.
import schoolLogo from "../assets/logo.png";

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
  fullName: ["fullname", "full name", "name", "studentname", "student name", "students full name", "student full name", "students name"],
  motherName: ["mothername", "mother name", "mathername", "mather name", "mothersname"],
  gender: ["gender", "sex", "students gender", "student gender"],
  placeOfBirth: ["placeofbirth", "place of birth", "birthplace", "pob"],
  dateOfBirth: ["dateofbirth", "date of birth", "dob", "birthdate", "date"],
  feeType: ["feetype", "fee type"],
  monthlyFee: ["monthlyfee", "monthly fee", "fee"],
  parentPhone: ["parentphone", "parent phone", "prentphone", "guardian phone", "guardian tel", "guardian telephone", "guardian phone number", "parents phone", "parent tel"],
  studentPhone: ["studentphone", "student phone", "students phone", "student phone number", "students phone number", "student tel", "students tel"],
  district: ["district", "distiric", "distric"],
  previousSchool: ["previousschool", "previous school"],
  orphanStatus: ["orphanstatus", "orphan status", "orphon status", "orphan", "orphon", "orphan type", "orphon type"],
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

// Taariikhda dhalashada ee Excel (tusaale 6/30/2009 — M/D/YYYY) waxaa loo beddelayaa
// YYYY-MM-DD, sida foomka "Hal Student" (input type="date") u kaydiyo, si Age-ku
// si sax ah loo xisaabiyo oo edit-ka taariikhdu u muuqato. Haddii qaabka aan la
// aqoonsan, sida uu yahay ayaa loo dhigayaa.
function normalizeDateOfBirth(raw) {
  const v = (raw || "").trim();
  if (!v) return "";
  const pad = (n) => String(n).padStart(2, "0");

  let m = v.match(/^(\d{4})[\/\-.](\d{1,2})[\/\-.](\d{1,2})$/);
  if (m) return `${m[1]}-${pad(m[2])}-${pad(m[3])}`;

  m = v.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})$/);
  if (m) {
    const first = Number(m[1]);
    const second = Number(m[2]);
    // Excel (US): M/D/YYYY. Haddii tirada hore ka weyn tahay 12, waa D/M/YYYY.
    let month = first;
    let day = second;
    if (first > 12 && second <= 12) {
      month = second;
      day = first;
    }
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      return `${m[3]}-${pad(month)}-${pad(day)}`;
    }
  }
  return v;
}

// Haddii maamulku uusan gelin Password, si toos ah ayaa loo dhigayaa
// afarta lambar ee ugu dambeeya ee Student Phone-ka. Haddii Student
// Phone maqan yahay, waxaa loo isticmaalaa afarta lambar ee ugu
// dambeeya ee Parent Phone (Guardian Tel) halkiisa.
function autoPassword(studentPhone, parentPhone) {
  const fromStudent = (studentPhone || "").replace(/\D/g, "");
  if (fromStudent.length >= 4) return fromStudent.slice(-4);

  const fromParent = (parentPhone || "").replace(/\D/g, "");
  if (fromParent.length >= 4) return fromParent.slice(-4);

  return "";
}

// Marka "Both" (Male & Female) la doorto, gender-ka saf kasta waxaa laga
// akhrinayaa xogtiisa gaarka ah (column-ka Gender), ma aha doorashada
// dropdown-ka. Tan waxay si dabacsan u aqoonsataa "Male"/"M"/"Female"/"F"
// iyada oo aan waxba ka welwelin xarfaha yar/wayn.
function normalizeGender(raw) {
  const v = (raw || "").trim().toLowerCase();
  if (v === "male" || v === "m") return "Male";
  if (v === "female" || v === "f") return "Female";
  return null;
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
  const [saveProgress, setSaveProgress] = useState({ done: 0, total: 0 });
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
    // (10-ka safood ee ugu horreeya ayaa la eegayaa, haddii cinwaan aan tab lahayn uu ka horreeyo.)
    const delimiter = rawLines.slice(0, 10).some((line) => line.includes("\t")) ? "\t" : ",";

    // Header-ka (magacyada column-ka Excel) waxaa laga raadinayaa 10-ka safood ee
    // ugu horreeya, isagoo lagu barbardhigayo FIELD_ALIASES. Haddii Excel-ku
    // cinwaan ama safaf kale ka horreeyo header-ka, waa la iska dhaafayaa.
    let fieldIndexMap = {};
    let headerLineIdx = -1;
    for (let li = 0; li < Math.min(rawLines.length, 10); li++) {
      const cells = rawLines[li].split(delimiter).map((c) => c.trim());
      const candidateMap = {};
      cells.forEach((cell, idx) => {
        const key = ALIAS_TO_FIELD[normalizeHeaderCell(cell)];
        if (key && candidateMap[key] === undefined) {
          candidateMap[key] = idx;
        }
      });
      if (candidateMap.fullName !== undefined && candidateMap.motherName !== undefined) {
        fieldIndexMap = candidateMap;
        headerLineIdx = li;
        break;
      }
    }
    const hasHeader = headerLineIdx !== -1;

    const dataLines = hasHeader ? rawLines.slice(headerLineIdx + 1) : rawLines;

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
      const dateOfBirth = normalizeDateOfBirth(getVal(parts, "dateOfBirth", 4));
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

      // Password ikhtiyaari (optional) — haddii aan la gelin, si toos ah
      // ayaa looga dhigayaa afarta lambar ee ugu dambeeya ee Student
      // Phone, ama haddii kale Parent Phone.
      const finalParentPassword = parentPassword || autoPassword(studentPhone, parentPhone);

      // Class iyo Shift had iyo jeer waxaa laga qaataa doorashada kore
      // (labada qayb ee kor ku yaal). Haddii safku wax ku qorayo meesha,
      // waa la iska indho-tiraa oo lama isticmaalo.
      const shift = selectedShift;

      // Gender: marka "Both" la doorto, mid kasta xogtiisa gaarka ah
      // (column-ka Gender) ayaa laga akhrinayaa; haddii kale (Male ama
      // Female si gaar ah loo doortay), dhammaan ardayda isla gender-kaas
      // ayaa loo dhigayaa, sida hore.
      let gender = selectedGender;
      if (selectedGender === "Both") {
        const rowGender = getVal(parts, "gender", 2);
        const normalized = normalizeGender(rowGender);
        if (!normalized) {
          alert(
            `Safka ${lineNum}${fullName ? ` (${fullName})` : ""}: Gender-ka waa ka dhiman yahay ama sax ma aha (waa in uu ahaadaa Male ama Female), maadaama aad dooratay "Male & Female".`
          );
          return null;
        }
        gender = normalized;
      }

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
      // FeeCategory iyo FeeCategoryAmount labaduba waa ikhtiyaari (optional) —
      // haddii FeeCategory la geliyo laakiin qiimo aan lagu darin, si toos ah
      // ayaa loo dhigayaa "0", mana joojinayo import-ka.

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
        parentPassword: finalParentPassword,
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

    // Wraps one write/update so that if it fails, the error message says
    // exactly which Firestore collection it was trying to write to —
    // instead of a bare "Missing or insufficient permissions" with no
    // context about where in the import it happened.
    const step = async (label, fn) => {
      try {
        await fn();
      } catch (err) {
        const e = new Error(`Collection "${label}": ${err.message}`);
        e.code = err.code;
        throw e;
      }
    };

    try {
      setSaving(true);
      setSaveProgress({ done: 0, total: parsedList.length });
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

        try {
          // 1. Save to `students`
          await step("students", () =>
            setDoc(doc(db, "students", studentId), {
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
              studentPhoto: schoolLogo,
              createdAt: new Date(),
            })
          );

          // 2. Save to `attendance`
          await step("attendance", () =>
            setDoc(doc(db, "attendance", studentId), {
              studentId,
              studentName: student.fullName,
            })
          );

          // 3. Save to `cashier`
          await step("cashier", () =>
            setDoc(doc(db, "cashier", studentId), {
              studentId,
              studentName: student.fullName,
              studentPhone: student.studentPhone,
              parentPhone: student.parentPhone,
              // Cashier-ku waligiis ma helo "Paid" import-ka ka imaanaya: ardayda
              // lacag-bixiya waxaa loo qoraa "Unpaid" (Monthly Fee kaliya ayaa
              // la muujiyaa). Paid/Unpaid wuxuu ku go'aansadaa Classes.jsx.
              // Ardayda "Free" ah Free ayay ahaanayaan.
              feeType: student.feeType === "Free" ? "Free" : "Unpaid",
              monthlyFee: student.monthlyFee,
              feeCategory: student.feeCategory,
              registrationFees,
              rollNumberFees,
              examinationFees,
            })
          );

          // 4. Save to `studentIdCards`
          await step("studentIdCards", () =>
            setDoc(doc(db, "studentIdCards", studentId), {
              studentId,
              fullName: student.fullName,
              motherName: student.motherName,
              gender: student.gender,
              placeOfBirth: student.placeOfBirth,
              dateOfBirth: student.dateOfBirth,
              age: finalAge,
              className: selectedClass,
              shift: student.shift,
              studentPhoto: schoolLogo,
              district: student.district,
              parentPhone: student.parentPhone,
              studentPhone: student.studentPhone,
              idIssuedAt: new Date(),
              issuedAt: new Date(),
              createdAt: new Date(),
            })
          );

          // 5. Attach to teachers
          await step("teachers", () =>
            attachStudentToClassTeachers(
              teachersSnap,
              selectedClass,
              studentId,
              student.fullName
            )
          );
        } catch (stepErr) {
          // Stop here, but report exactly how far we got and who/what
          // failed, instead of a bare permissions message with no context.
          const progressNote =
            saved.length > 0
              ? `${saved.length} arday ayaa si guul leh loo kaydiyay ka hor intii khaladkan aanu dhicin (studentId-yadoodu waa ${saved[0].studentId} ilaa ${saved[saved.length - 1].studentId}).`
              : "Weli arday lama kaydin ka hor intii khaladkan aanu dhicin.";
          throw new Error(
            `Waxaa ku dhacay khalad markii la kaydinayay ardayga "${student.fullName}" (safka ${i + 1}, studentId la isku dayay: ${studentId}).\n\n${stepErr.message}\n\n${progressNote}`
          );
        }

        saved.push({
          ...student,
          studentId,
        });
        setSaveProgress({ done: i + 1, total: parsedList.length });
      }

      setSavedStudents(saved);
      setShowPopup(true);
      setTextInput("");
    } catch (err) {
      console.log(err);
      alert(err.message);
    } finally {
      setSaving(false);
      setSaveProgress({ done: 0, total: 0 });
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
                <option value="Both">Male &amp; Female (ka akhri xogta safka)</option>
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
              <strong style={{ color: "#e5e3f7" }}>1) Excel Paste (ugu fudud):</strong> Excel-ka xogta ka koobiyee (copy) oo halkan ku dheji (paste) — si toos ah. Safka koowaad (row 1) ha ka kooban yahay magacyada column-ka (tusaale: FullName, MotherName, District, DateOfBirth, StudentPhone, ParentPhone, iwm). Nidaamka (order) ee tiirarku dani ma leh — system-ku wuxuu magaca column-ka ku ogaanayaa meesha saxda ah. Magacyada Excel-ka sida Students Full Name, Mothers Name, Students Phone, DOB, POB, District, Orphon, Guardian Phone si toos ah ayaa loo aqoonsadaa (S/n iyo Guardian Name waa la iska indho-tiraa).
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
              * <strong>Class &amp; Shift:</strong> Had iyo jeer waxaa laga qaataa doorashada kore. Haddii safka lagu qoro qiyam kale, si toos ah ayaa loo iska indho-tiraa.<br/>
              * <strong>Gender:</strong> Haddii Male ama Female si gaar ah loo doorto, dhammaan ardayda waa loo dhigaa isla gender-kaas. Haddii "Male &amp; Female" la doorto, mid kasta gender-kiisa waxaa laga akhrinayaa column-ka Gender ee safka (Male/Female/M/F).<br/>
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
                  {saveProgress.total > 0
                    ? `Kaydinaya... (${saveProgress.done}/${saveProgress.total})`
                    : "Kaydinaya..."}
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