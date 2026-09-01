import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { db, storage } from "../../firebase/firebase";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import {
  doc,
  setDoc,
  collection,
  getDocs,
  updateDoc,
  arrayUnion,
} from "firebase/firestore";
import {
  Users,
  Plus,
  Save,
  X,
  Upload,
  CheckCircle2,
  ArrowRight,
} from "lucide-react";

// ✅ Liiska fasalada oo la cusboonaysiiyay
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

// ✅ Doorashada nooca fee-ga gaarka ah (Registration / Roll Number / Examination)
const feeCategoryOptions = [
  { value: "", label: "Select Fee Category" },
  { value: "Registration Fees", label: "Registration Fees" },
  { value: "Roll Number Fees", label: "Roll Number Fees" },
  { value: "Examination Fees", label: "Examination Fees" },
];

const normalizeClassName = (name) => name.trim().replace(/\s+/g, " ").toLowerCase();

const emptyRow = () => ({
  fullName: "",
  motherName: "", // ✅ Magaca Hooyada - field cusub
  className: "",
  shift: "",
  feeType: "Free",
  monthlyFee: "",
  feeCategory: "", // ✅ Doorashada: Registration / Roll Number / Examination
  feeCategoryAmount: "", // ✅ Qiimaha la geliyo gacanta ee doorashada la doortay
  parentPhone: "",
  studentPhone: "",
  district: "",
  hasPreviousSchool: "No", // ✅ Yes/No - Previous School
  previousSchool: "",
  orphanStatus: "No",
  parentPassword: "",
  studentPhoto: null,
});

export default function BulkRegistration() {
  const navigate = useNavigate();

  const [students, setStudents] = useState([emptyRow()]);
  const [showPopup, setShowPopup] = useState(false);
  const [savedStudents, setSavedStudents] = useState([]);
  const [saving, setSaving] = useState(false);

  // ✅ Fasalada admin-ku "Create Class" ka daray AddStudent.jsx — waxaa
  // lagu kaydiyay Firestore collection "customClasses". Halkan ayaan ka
  // soo aqrinaynaa si dropdown-ka Class Name ee Bulk Registration uu
  // isla wada aragaan fasalada cusub, isla habka AddStudent.jsx.
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

  // ✅ Liiska dhamaystiran ee dropdown-ka Class Name: fasalada rasmiga
  // ah oo hore u jiray, kadibna fasalada cusub ee la sameeyay — kuwaas
  // oo si alphabetical ah loo kala saaray, isla habka AddStudent.jsx.
  const allClassOptions = useMemo(() => {
    const customNames = customClasses
      .map((c) => c.name)
      .filter(
        (name) => !classOptions.some((c) => normalizeClassName(c) === normalizeClassName(name))
      )
      .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
    return [...classOptions, ...customNames];
  }, [customClasses]);

  const addRow = () => {
    setStudents([...students, emptyRow()]);
  };

  const handleLastFieldKeyDown = (index, e) => {
    const isLastRow = index === students.length - 1;
    if (!isLastRow) return;

    if (e.key === "Enter" || e.key === "Tab") {
      e.preventDefault();
      addRow();

      setTimeout(() => {
        const nextInput = document.querySelector(
          `[data-row="${index + 1}"][data-field="fullName"]`
        );
        if (nextInput) nextInput.focus();
      }, 0);
    }
  };

  const removeRow = (index) => {
    if (students.length === 1) return;
    setStudents(students.filter((_, i) => i !== index));
  };

  const handleChange = (index, field, value) => {
    const data = [...students];
    data[index][field] = value;
    setStudents(data);
  };

  const handleFeeTypeChange = (index, value) => {
    const data = [...students];
    data[index].feeType = value;
    if (value === "Free") {
      data[index].monthlyFee = "0";
    }
    setStudents(data);
  };

  // ✅ Marka la beddelo doorashada Fee Category, qiimaha hore ee la geliyay waa la nadiifiyaa
  // si loo bilaabo mid cusub oo ku habboon doorashada cusub.
  const handleFeeCategoryChange = (index, value) => {
    const data = [...students];
    data[index].feeCategory = value;
    data[index].feeCategoryAmount = "";
    setStudents(data);
  };

  // ✅ Yes/No toggle ee Previous School
  const handlePreviousSchoolToggle = (index, value) => {
    const data = [...students];
    data[index].hasPreviousSchool = value;
    if (value === "No") {
      data[index].previousSchool = "";
    }
    setStudents(data);
  };

  const handleFileChange = (index, file) => {
    const data = [...students];
    data[index].studentPhoto = file;
    setStudents(data);
  };

  // ✅ Parent Phone iyo Student Phone — lambar keliya (0-9) ayaa la ogolaanayaa
  const handlePhoneChange = (index, field, value) => {
    const digitsOnly = value.replace(/[^0-9]/g, "");
    const data = [...students];
    data[index][field] = digitsOnly;
    setStudents(data);
  };

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

  // ✅ Hubinta xogta safka hore intaan la kaydin — sawirka hadda waa
  // ikhtiyaari, lambarrada ayaa weli la hubiyaa
  const validateStudents = () => {
    for (let i = 0; i < students.length; i++) {
      const s = students[i];
      const rowLabel = `Safka ${i + 1}`;

      if (!s.fullName.trim()) {
        alert(`${rowLabel}: Fadlan geli Magaca Ardayga`);
        return false;
      }

      // ✅ Hubinta Magaca Hooyada - waajib
      if (!s.motherName.trim()) {
        alert(`${rowLabel}: Fadlan geli Magaca Hooyada`);
        return false;
      }

      if (!s.className) {
        alert(`${rowLabel}: Fadlan dooro Class`);
        return false;
      }

      if (s.feeType === "Paid" && !String(s.monthlyFee).trim()) {
        alert(`${rowLabel}: Fadlan geli Qiimaha Fee-ga bishii (Paid)`);
        return false;
      }

      // ✅ Hadii Fee Category la doortay, qiimihiisa waa waajib
      if (s.feeCategory && !String(s.feeCategoryAmount).trim()) {
        alert(`${rowLabel}: Fadlan geli qiimaha ${s.feeCategory}`);
        return false;
      }

      // ✅ Hadii Previous School la sheegay "Yes", magaca dugsiga waa waajib
      if (s.hasPreviousSchool === "Yes" && !s.previousSchool.trim()) {
        alert(`${rowLabel}: Fadlan geli magaca Dugsiga Hore`);
        return false;
      }

      if (s.parentPhone && !/^\d+$/.test(s.parentPhone)) {
        alert(`${rowLabel}: Parent Phone waa inuu ahaadaa lambar keliya (numbers only)`);
        return false;
      }

      if (s.studentPhone && !/^\d+$/.test(s.studentPhone)) {
        alert(`${rowLabel}: Student Phone waa inuu ahaadaa lambar keliya (numbers only)`);
        return false;
      }

      // Sawirka ardayga hadda waa ikhtiyaari (optional) — lama qasbo.
    }
    return true;
  };

  const saveStudents = async () => {
    try {
      // ✅ Ka hor inta aan wax la kaydin, hubi dhammaan safafka
      if (!validateStudents()) return;

      setSaving(true);
      const saved = [];

      // ✅ Sida ay ku jireen ardayda hore ee database-ka, si aan ID-yadu
      // isugu daba socdaan oo aan wax laga tagin ama laba arday isku ID
      // isku helin — waxaan halkan ka soo aqrinaynaa tirada ardayda jira.
      const existingSnap = await getDocs(collection(db, "students"));
      let nextIdNumber = existingSnap.size;

      const teachersSnap = await getDocs(collection(db, "teachers"));

      for (let i = 0; i < students.length; i++) {
        const student = students[i];

        nextIdNumber += 1;
        const studentId = String(nextIdNumber).padStart(4, "0");

        // Sawirka waa ikhtiyaari — haddii uu la doortay wuu soo shubmayaa,
        // haddii kalese photoURL wuxuu ahaanayaa string madhan.
        let photoURL = "";
        if (student.studentPhoto) {
          const photoRef = ref(
            storage,
            `students/${studentId}/${Date.now()}_${student.studentPhoto.name}`
          );
          await uploadBytes(photoRef, student.studentPhoto);
          photoURL = await getDownloadURL(photoRef);
        }

        const finalMonthlyFee = student.feeType === "Free" ? "0" : student.monthlyFee;

        // ✅ Xogta saddexda fee ee gaarka ah — waxaa la kaydiyaa keliya nooca
        // la doortay iyo qiimihiisa (labada kale waa 0).
        const registrationFees =
          student.feeCategory === "Registration Fees" ? student.feeCategoryAmount : "0";
        const rollNumberFees =
          student.feeCategory === "Roll Number Fees" ? student.feeCategoryAmount : "0";
        const examinationFees =
          student.feeCategory === "Examination Fees" ? student.feeCategoryAmount : "0";

        await setDoc(doc(db, "students", studentId), {
          studentId,
          fullName: student.fullName,
          motherName: student.motherName, // ✅ Magaca Hooyada oo lagu kaydiyo students
          className: student.className,
          shift: student.shift,
          feeType: student.feeType,
          monthlyFee: finalMonthlyFee,
          feeCategory: student.feeCategory,
          registrationFees,
          rollNumberFees,
          examinationFees,
          parentPhone: student.parentPhone,
          studentPhone: student.studentPhone,
          district: student.district,
          previousSchool: student.hasPreviousSchool === "Yes" ? student.previousSchool : "",
          orphanStatus: student.orphanStatus,
          parentPassword: student.parentPassword,
          studentPhoto: photoURL,
          createdAt: new Date(),
        });

        await setDoc(doc(db, "attendance", studentId), {
          studentId,
          studentName: student.fullName,
        });

        await setDoc(doc(db, "cashier", studentId), {
          studentId,
          studentName: student.fullName,
          studentPhone: student.studentPhone,
          parentPhone: student.parentPhone,
          feeType: student.feeType,
          monthlyFee: finalMonthlyFee,
          feeCategory: student.feeCategory,
          registrationFees,
          rollNumberFees,
          examinationFees,
        });

        await setDoc(doc(db, "studentIdCards", studentId), {
          studentId,
          fullName: student.fullName,
          motherName: student.motherName, // ✅ Magaca Hooyada oo lagu daro ID Card-ka
          className: student.className,
          shift: student.shift,
          studentPhoto: photoURL,
          district: student.district,
          parentPhone: student.parentPhone,
          studentPhone: student.studentPhone,
          idIssuedAt: new Date(),
          issuedAt: new Date(),
          createdAt: new Date(),
        });

        if (student.className) {
          await attachStudentToClassTeachers(
            teachersSnap,
            student.className,
            studentId,
            student.fullName
          );
        }

        saved.push({
          ...student,
          studentId,
        });
      }

      setSavedStudents(saved);
      setShowPopup(true);

      // ✅ Marka la kaydiyo si guul leh, jaddwalka waa in uu mar kale
      // ka bilaabmaa xog cusub oo faaruq ah — safkii hore lama arki doono mar dambe
      setStudents([emptyRow()]);
    } catch (err) {
      console.log(err);
      alert(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ background: "#0b0a1c", minHeight: "100vh", padding: "30px" }}>
      <div
        style={{
          background: "linear-gradient(160deg,#151233,#181341)",
          borderRadius: 24,
          padding: "36px 40px",
          border: "1px solid rgba(139,108,245,0.25)",
        }}
      >
        {/* ---- Header ---- */}
        <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 30 }}>
          <div
            style={{
              width: 52,
              height: 52,
              minWidth: 52,
              borderRadius: 14,
              background: "linear-gradient(135deg,#6d5df0,#8b6cf5)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: "0 8px 20px rgba(109,93,240,0.3)",
            }}
          >
            <Users color="#fff" size={26} />
          </div>
          <div>
            <h1 style={{ margin: 0, fontSize: 24, fontWeight: 800, color: "#fff" }}>
              Bulk Student Registration
            </h1>
            <p style={{ margin: "4px 0 0", color: "#8b87ad", fontSize: 13.5 }}>
              Ku dar dhowr arday hal mar, si degdeg ah oo sahlan.
            </p>
          </div>
        </div>

        {/* ---- Table ---- */}
        <div style={{ overflowX: "auto", borderRadius: 16, border: "1px solid rgba(139,108,245,0.2)" }}>
          <table
            style={{
              width: "100%",
              borderCollapse: "collapse",
              minWidth: 1900,
            }}
          >
            <thead>
              <tr style={{ textAlign: "left", background: "rgba(139,108,245,0.08)" }}>
                <th style={th}>Full Name</th>
                <th style={th}>Mother Name</th>
                <th style={th}>Class Name</th>
                <th style={th}>Shift</th>
                <th style={th}>Fee Type</th>
                <th style={th}>Monthly Fee ($)</th>
                <th style={th}>Fee Category</th>
                <th style={th}>Fee Amount ($)</th>
                <th style={th}>Parent Phone</th>
                <th style={th}>Student Phone</th>
                <th style={th}>District</th>
                <th style={th}>Previous School?</th>
                <th style={th}>Previous School Name</th>
                <th style={th}>Orphan Status</th>
                <th style={th}>Parent Password</th>
                <th style={th}>Student Photo</th>
                <th style={{ ...th, textAlign: "center" }}></th>
              </tr>
            </thead>

            <tbody>
              {students.map((student, index) => (
                <tr key={index}>
                  <td style={td}>
                    <input
                      style={input}
                      data-row={index}
                      data-field="fullName"
                      placeholder="Magaca oo dhan"
                      value={student.fullName}
                      onChange={(e) =>
                        handleChange(index, "fullName", e.target.value)
                      }
                    />
                  </td>

                  {/* ✅ Column cusub: Magaca Hooyada */}
                  <td style={td}>
                    <input
                      style={input}
                      data-row={index}
                      data-field="motherName"
                      placeholder="Magaca Hooyada"
                      value={student.motherName}
                      onChange={(e) =>
                        handleChange(index, "motherName", e.target.value)
                      }
                    />
                  </td>

                  <td style={td}>
                    <select
                      style={input}
                      value={student.className}
                      onChange={(e) =>
                        handleChange(index, "className", e.target.value)
                      }
                    >
                      <option value="">Select Class</option>
                      {allClassOptions.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  </td>

                  <td style={td}>
                    <select
                      style={input}
                      value={student.shift}
                      onChange={(e) =>
                        handleChange(index, "shift", e.target.value)
                      }
                    >
                      <option value="">Select</option>
                      <option value="Morning">🌅 Morning</option>
                      <option value="Afternoon">🌇 Afternoon</option>
                    </select>
                  </td>

                  <td style={td}>
                    <select
                      style={input}
                      value={student.feeType}
                      onChange={(e) =>
                        handleFeeTypeChange(index, e.target.value)
                      }
                    >
                      <option value="Free">🆓 Free</option>
                      <option value="Paid">💵 Paid</option>
                    </select>
                  </td>

                  <td style={td}>
                    <input
                      style={{
                        ...input,
                        opacity: student.feeType === "Free" ? 0.4 : 1,
                      }}
                      type="number"
                      placeholder="0.00"
                      disabled={student.feeType === "Free"}
                      value={student.feeType === "Free" ? "0" : student.monthlyFee}
                      onChange={(e) =>
                        handleChange(index, "monthlyFee", e.target.value)
                      }
                    />
                  </td>

                  {/* ✅ Doorasho hal mid ah oo ka mid ah Registration / Roll Number / Examination */}
                  <td style={td}>
                    <select
                      style={input}
                      value={student.feeCategory}
                      onChange={(e) =>
                        handleFeeCategoryChange(index, e.target.value)
                      }
                    >
                      {feeCategoryOptions.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </td>

                  {/* ✅ Qiimaha doorashada la doortay — gacanta lagu qoro */}
                  <td style={td}>
                    <input
                      style={{
                        ...input,
                        opacity: student.feeCategory ? 1 : 0.4,
                      }}
                      type="number"
                      placeholder="0.00"
                      disabled={!student.feeCategory}
                      value={student.feeCategoryAmount}
                      onChange={(e) =>
                        handleChange(index, "feeCategoryAmount", e.target.value)
                      }
                    />
                  </td>

                  <td style={td}>
                    <input
                      style={input}
                      type="tel"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      placeholder="61xxxxxxx"
                      value={student.parentPhone}
                      onChange={(e) =>
                        handlePhoneChange(index, "parentPhone", e.target.value)
                      }
                    />
                  </td>

                  <td style={td}>
                    <input
                      style={input}
                      type="tel"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      placeholder="61xxxxxxx"
                      value={student.studentPhone}
                      onChange={(e) =>
                        handlePhoneChange(index, "studentPhone", e.target.value)
                      }
                    />
                  </td>

                  <td style={td}>
                    <input
                      style={input}
                      placeholder="Degmada"
                      value={student.district}
                      onChange={(e) =>
                        handleChange(index, "district", e.target.value)
                      }
                    />
                  </td>

                  {/* ✅ Previous School — Yes/No */}
                  <td style={td}>
                    <select
                      style={input}
                      value={student.hasPreviousSchool}
                      onChange={(e) =>
                        handlePreviousSchoolToggle(index, e.target.value)
                      }
                    >
                      <option value="No">No</option>
                      <option value="Yes">Yes</option>
                    </select>
                  </td>

                  {/* ✅ Marka "Yes" la doorto, magaca dugsiga waa lagu qoraa gacanta */}
                  <td style={td}>
                    <input
                      style={{
                        ...input,
                        opacity: student.hasPreviousSchool === "Yes" ? 1 : 0.4,
                      }}
                      placeholder="Dugsigii hore"
                      disabled={student.hasPreviousSchool !== "Yes"}
                      value={student.previousSchool}
                      onChange={(e) =>
                        handleChange(index, "previousSchool", e.target.value)
                      }
                    />
                  </td>

                  <td style={td}>
                    <select
                      style={input}
                      value={student.orphanStatus}
                      onChange={(e) =>
                        handleChange(index, "orphanStatus", e.target.value)
                      }
                    >
                      <option>No</option>
                      <option>Yes</option>
                    </select>
                  </td>

                  <td style={td}>
                    <input
                      style={input}
                      placeholder="••••••••"
                      value={student.parentPassword}
                      onChange={(e) =>
                        handleChange(index, "parentPassword", e.target.value)
                      }
                    />
                  </td>

                  <td style={td}>
                    <label
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 6,
                        color: student.studentPhoto ? "#4ade80" : "#a9a6c4",
                        fontSize: 12,
                        cursor: "pointer",
                        border: student.studentPhoto
                          ? "1px solid rgba(74,222,128,0.4)"
                          : "1px dashed rgba(139,108,245,0.4)",
                        borderRadius: 8,
                        padding: "7px 9px",
                        whiteSpace: "nowrap",
                      }}
                    >
                      <Upload size={13} color={student.studentPhoto ? "#4ade80" : "#a9a6c4"} />
                      {student.studentPhoto ? student.studentPhoto.name.slice(0, 10) + "…" : "Upload"}
                      <input
                        type="file"
                        accept="image/*"
                        data-row={index}
                        data-field="studentPhoto"
                        onChange={(e) =>
                          handleFileChange(index, e.target.files[0])
                        }
                        onKeyDown={(e) => handleLastFieldKeyDown(index, e)}
                        style={{ display: "none" }}
                      />
                    </label>
                  </td>

                  <td style={{ ...td, textAlign: "center" }}>
                    <button
                      onClick={() => removeRow(index)}
                      style={{
                        background: "rgba(239,68,68,0.15)",
                        color: "#f87171",
                        border: "1px solid rgba(239,68,68,0.3)",
                        borderRadius: 8,
                        width: 30,
                        height: 30,
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        cursor: "pointer",
                      }}
                    >
                      <X size={14} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* ---- Buttons-ka hoose ---- */}
        <div style={{ display: "flex", gap: 14, marginTop: 24 }}>
          <button onClick={addRow} style={btnSecondary}>
            <Plus size={17} />
            Add Row
          </button>

          <button
            onClick={saveStudents}
            disabled={saving}
            style={{
              ...btnPrimary,
              opacity: saving ? 0.7 : 1,
              cursor: saving ? "not-allowed" : "pointer",
            }}
          >
            <Save size={17} />
            {saving ? "Kaydinaya..." : "Save All"}
          </button>
        </div>
      </div>

      {/* ---- Popup-ka guusha ---- */}
      {showPopup && (
        <div style={popupOverlay}>
          <div style={popupCard}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
              <div
                style={{
                  width: 46,
                  height: 46,
                  minWidth: 46,
                  borderRadius: "50%",
                  background: "rgba(34,197,94,0.15)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <CheckCircle2 color="#4ade80" size={24} />
              </div>
              <h2 style={{ color: "#fff", margin: 0, fontSize: 19 }}>
                Students Saved Successfully
              </h2>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {savedStudents.map((student) => (
                <div
                  key={student.studentId}
                  style={{
                    background: "rgba(255,255,255,0.03)",
                    borderRadius: 10,
                    padding: "10px 14px",
                    border: "1px solid rgba(139,108,245,0.15)",
                  }}
                >
                  <div style={{ color: "#fff", fontWeight: 600, fontSize: 14 }}>
                    {student.fullName || "—"}
                  </div>
                  <div style={{ color: "#8b87ad", fontSize: 12.5, marginTop: 2 }}>
                    Student ID: {student.studentId}
                  </div>
                </div>
              ))}
            </div>

            <button
              onClick={() => {
                // ✅ Marka la aado bogga ardayda, popup-ka xir oo
                // savedStudents nadiifi si booqasho dambe uusan u muuqan
                setShowPopup(false);
                setSavedStudents([]);
                navigate("/admin/students");
              }}
              style={{ ...btnPrimary, width: "100%", marginTop: 22, justifyContent: "center" }}
            >
              Go To Students
              <ArrowRight size={17} />
            </button>
          </div>
        </div>
      )}

      <style>{`
        input::placeholder {
          color: #6b6890;
        }
        select option {
          background: #1e1a4a;
          color: #ffffff;
        }
      `}</style>
    </div>
  );
}

const th = {
  padding: "12px 10px",
  color: "#a9a6c4",
  fontSize: 12,
  fontWeight: 700,
  whiteSpace: "nowrap",
  borderBottom: "1px solid rgba(139,108,245,0.2)",
};

const td = {
  padding: "8px 10px",
  borderBottom: "1px solid rgba(139,108,245,0.1)",
};

const input = {
  width: "100%",
  padding: "8px 10px",
  boxSizing: "border-box",
  border: "1.5px solid rgba(139,108,245,0.3)",
  borderRadius: 9,
  fontSize: 12.5,
  color: "#e5e3f7",
  background: "rgba(255,255,255,0.02)",
  outline: "none",
  minWidth: 110,
};

const btnPrimary = {
  display: "inline-flex",
  alignItems: "center",
  gap: 9,
  background: "linear-gradient(90deg,#6d5df0,#8b6cf5)",
  color: "#fff",
  border: "none",
  borderRadius: 12,
  padding: "13px 24px",
  fontWeight: 700,
  fontSize: 14.5,
  boxShadow: "0 10px 24px rgba(109,93,240,0.35)",
};

const btnSecondary = {
  display: "inline-flex",
  alignItems: "center",
  gap: 9,
  background: "rgba(255,255,255,0.04)",
  color: "#fff",
  border: "1.5px solid rgba(139,108,245,0.35)",
  borderRadius: 12,
  padding: "13px 24px",
  fontWeight: 700,
  fontSize: 14.5,
  cursor: "pointer",
};

const popupOverlay = {
  position: "fixed",
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  background: "rgba(0,0,0,0.6)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  zIndex: 1000,
};

const popupCard = {
  background: "linear-gradient(160deg,#151233,#181341)",
  border: "1px solid rgba(139,108,245,0.3)",
  borderRadius: 18,
  padding: 30,
  minWidth: 380,
  maxWidth: 500,
  maxHeight: "80vh",
  overflowY: "auto",
};