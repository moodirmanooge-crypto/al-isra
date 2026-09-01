import { useEffect, useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { db, storage } from "../../firebase/firebase";
import {
  collection,
  getDocs,
  doc,
  updateDoc,
  deleteDoc,
} from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import jsPDF from "jspdf";
import * as XLSX from "xlsx";
import Sidebar from "../components/Sidebar";
import Topbar from "../components/Topbar";
import {
  Plus,
  Upload,
  Search,
  GraduationCap,
  Pencil,
  Trash2,
  X,
  Save,
  Loader2,
  User,
  School,
  Wallet,
  Phone,
  Smartphone,
  MapPin,
  BookOpen,
  Heart,
  Lock,
  Camera,
  Hash,
  Receipt,
  IdCard,
  Download,
  FileSpreadsheet,
} from "lucide-react";

const classOptions = ["Fasalka 1aad", "Fasalka 2aad", "Fasalka 3aad",  "PP", "PI", "G8 A", "G8 B", "F1", "F2", "F3", "F4"];

// ✅ Doorashada nooca fee-ga gaarka ah — isla mid AddStudent.jsx
// isticmaalo (Registration / Roll Number / Examination), si edit-ka
// halkan uu isla wada aqriyo/kaydiyo qaab-dhismeedka fee-ga oo dhan.
const feeCategoryOptions = [
  { value: "", label: "Select Fee Category" },
  { value: "Registration Fees", label: "Registration Fees" },
  { value: "Roll Number Fees", label: "Roll Number Fees" },
  { value: "Examination Fees", label: "Examination Fees" },
];

// Different registration flows over time have saved the photo URL under
// slightly different field names (studentPhoto is current, but photoUrl
// / photo show up on some older records) — check all of them, and trim
// stray whitespace some records picked up (e.g. a trailing space after
// the URL), which otherwise breaks the browser's ability to load it.
function getStudentPhotoUrl(student) {
  const raw =
    student.studentPhoto || student.photoUrl || student.photo || "";
  return typeof raw === "string" ? raw.trim() : "";
}

// ✅ Ka soo qaad qiimaha Fee Category-ga gaarka ah ee ardaygan (kaliya
// mid ka mid ah saddexda ayaa mar walba wax ku jira — labada kale waa
// "0"), si loo helo Fee Category + qiimihiisa isla habka AddStudent.jsx.
function getFeeCategoryAmount(student) {
  if (student.feeCategory === "Registration Fees") return student.registrationFees || "";
  if (student.feeCategory === "Roll Number Fees") return student.rollNumberFees || "";
  if (student.feeCategory === "Examination Fees") return student.examinationFees || "";
  return "";
}

// ✅ Firestore Timestamp (seconds) ama Date ama string — dhammaantood
// si isku mid ah loo tuso taariikh akhriyi karta bini'aadam.
function formatCreatedAt(createdAt) {
  if (!createdAt) return "—";
  let d;
  if (typeof createdAt?.toDate === "function") d = createdAt.toDate();
  else if (createdAt?.seconds) d = new Date(createdAt.seconds * 1000);
  else d = new Date(createdAt);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
}

// ✅ Soo deji sawirka sida data URL (base64) si loogu daro PDF-ka —
// haddii uu ku guuldareysto (CORS, sawir maqan, iwm) waxaan iska
// dhaafnaa oo PDF-ka waxaan ku dhisnaa xogta qoraalka ah oo kaliya.
async function fetchImageAsDataUrl(url) {
  const response = await fetch(url);
  const blob = await response.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

// ✅ "Download PDF" — samee hal warqad PDF ah oo ka kooban dhammaan
// xogta ardaygan sida uu ku diiwaan gashan yahay (Full Name, Mother
// Name, Class, Fee Type, Fee Category + qiimihiisa, taleefanada,
// degmada, iwm), kadibna si toos ah u soo deji faylka.
async function exportStudentPdf(student) {
  try {
    const pdf = new jsPDF();

    pdf.setFontSize(18);
    pdf.setFont(undefined, "bold");
    pdf.text("Student Registration Record", 105, 18, { align: "center" });
    pdf.setFont(undefined, "normal");
    pdf.setDrawColor(150, 150, 150);
    pdf.line(14, 24, 196, 24);

    let photoBottomY = 24;
    const photoUrl = getStudentPhotoUrl(student);
    if (photoUrl) {
      try {
        const imgData = await fetchImageAsDataUrl(photoUrl);
        pdf.addImage(imgData, "JPEG", 152, 30, 40, 40);
        photoBottomY = 74;
      } catch (imgErr) {
        console.log("Sawirka lama soo gelin PDF-ka:", imgErr);
      }
    }

    const feeCategoryAmount = getFeeCategoryAmount(student);

    const rows = [
      ["Student ID", student.studentId || "—"],
      ["Full Name", student.fullName || "—"],
      ["Mother Name", student.motherName || "—"],
      ["Class", student.className || "—"],
      ["Shift", student.shift || "—"],
      ["Fee Type", student.feeType || "—"],
      ["Monthly Fee", `$${student.monthlyFee || "0"}`],
      ["Fee Category", student.feeCategory || "—"],
      [
        "Fee Category Amount",
        feeCategoryAmount ? `$${feeCategoryAmount}` : "—",
      ],
      ["Parent Phone", student.parentPhone || "—"],
      ["Student Phone", student.studentPhone || "—"],
      ["District", student.district || "—"],
      ["Previous School", student.previousSchool || "—"],
      ["Orphan Status", student.orphanStatus || "No"],
      ["Parent Password", student.parentPassword || "—"],
      ["Registered On", formatCreatedAt(student.createdAt)],
    ];

    let y = Math.max(36, photoBottomY - 12);
    pdf.setFontSize(11);
    rows.forEach(([label, value]) => {
      if (y > 280) {
        pdf.addPage();
        y = 20;
      }
      pdf.setFont(undefined, "bold");
      pdf.text(`${label}:`, 14, y);
      pdf.setFont(undefined, "normal");
      pdf.text(String(value), 70, y);
      y += 9;
    });

    const fileSafeName = (student.fullName || "student").trim().replace(/\s+/g, "_");
    pdf.save(`${fileSafeName}_${student.studentId || ""}.pdf`);
  } catch (err) {
    console.log(err);
    alert("Waa la xumaaday soo saarista PDF-ka. Fadlan isku day mar kale.");
  }
}

// ✅ "Export Excel" — samee hal file Excel (.xlsx) ah oo saf u ah arday
// kasta ee la siiyay (dhammaan ama hal Class), oo ka kooban isla xogta
// PDF-ka arday-gaarka ah isticmaalo, kadibna si toos ah u soo deji.
function exportStudentsToExcel(studentsList, fileName) {
  const rows = studentsList.map((s) => ({
    "Student ID": s.studentId || "",
    "Full Name": s.fullName || "",
    "Mother Name": s.motherName || "",
    "Class": s.className || "",
    "Shift": s.shift || "",
    "Fee Type": s.feeType || "",
    "Monthly Fee": s.monthlyFee || "0",
    "Fee Category": s.feeCategory || "",
    "Fee Category Amount": getFeeCategoryAmount(s) || "",
    "Parent Phone": s.parentPhone || "",
    "Student Phone": s.studentPhone || "",
    "District": s.district || "",
    "Previous School": s.previousSchool || "",
    "Orphan Status": s.orphanStatus || "No",
    "Parent Password": s.parentPassword || "",
    "Registered On": formatCreatedAt(s.createdAt),
  }));

  const worksheet = XLSX.utils.json_to_sheet(rows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Students");
  XLSX.writeFile(workbook, fileName);
}

export default function Students() {
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const [selectedStudent, setSelectedStudent] = useState(null);
  const [editData, setEditData] = useState(null);
  const [photoPreview, setPhotoPreview] = useState(null);
  const [photoFile, setPhotoFile] = useState(null);
  const [saving, setSaving] = useState(false);
  const [exportingId, setExportingId] = useState(null);
  // ✅ "Export Excel" — dooro Class-ka la rabo in xogtiisa la dejiyo
  // (ama "All Classes" si dhammaan ardayda loo dejiyo hal mar).
  const [exportClassFilter, setExportClassFilter] = useState("All");
  const [exportingExcel, setExportingExcel] = useState(false);

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

  // ---- Raadinta arday: ID-giisa ama Password-kiisa ----
  // NOTE: ardayda la calaamadeeyay in la tirtirayo (pendingDeletion)
  // waxaa laga qariyaa liiska front-end-ka ilaa backend-ku uu approve gareeyo.
  const filteredStudents = students.filter((s) => {
    if (s.pendingDeletion) return false;

    const q = search.toLowerCase().trim();
    if (!q) return true;
    return (
      (s.studentId || "").toLowerCase().includes(q) ||
      (s.parentPassword || "").toLowerCase().includes(q) ||
      (s.fullName || "").toLowerCase().includes(q)
    );
  });

  // ✅ Liiska Class-yada dhab ahaan ku jira xogta ardayda (rasmi ah ama
  // custom), loo isticmaalo dropdown-ka "Export Excel" — si Class kasta
  // oo ay ardayda leeyihiin uu ka mid noqdo doorashada, xitaa haddii
  // uusan ka mid ahayn classOptions-ka static-ka ah.
  const availableClasses = useMemo(() => {
    const names = new Set(
      students
        .filter((s) => !s.pendingDeletion)
        .map((s) => s.className)
        .filter(Boolean)
    );
    return Array.from(names).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  }, [students]);

  // ---- Fur modal-ka wax-ka-bedelka ardayga ----
  function openEdit(student) {
    setSelectedStudent(student);
    setEditData({
      fullName: student.fullName || "",
      className: student.className || "",
      feeType: student.feeType || "Free",
      monthlyFee: student.monthlyFee || "",
      // ✅ Fee Category + qiimihiisa — soo aqriso xogtii AddStudent.jsx
      // kaydiyay (registrationFees/rollNumberFees/examinationFees),
      // si edit-kan uu u tuso oo la bedeli karo isla habka AddStudent.
      feeCategory: student.feeCategory || "",
      feeCategoryAmount: getFeeCategoryAmount(student),
      parentPhone: student.parentPhone || "",
      studentPhone: student.studentPhone || "",
      district: student.district || "",
      previousSchool: student.previousSchool || "",
      orphanStatus: student.orphanStatus || "No",
      parentPassword: student.parentPassword || "",
      studentPhoto: getStudentPhotoUrl(student),
    });
    setPhotoPreview(getStudentPhotoUrl(student) || null);
    setPhotoFile(null);
  }

  function closeEdit() {
    setSelectedStudent(null);
    setEditData(null);
    setPhotoPreview(null);
    setPhotoFile(null);
  }

  function handleEditChange(field, value) {
    setEditData({ ...editData, [field]: value });
  }

  // ✅ Marka Fee Type la bedelo (Free/Paid) — isla habka AddStudent.jsx:
  // haddii "Free" la doorto, Monthly Fee waa la nadiifiyaa una noqdaa "0".
  function handleEditFeeTypeChange(value) {
    setEditData({
      ...editData,
      feeType: value,
      monthlyFee: value === "Free" ? "0" : editData.monthlyFee,
    });
  }

  // ✅ Marka Fee Category la bedelo — qiimihii hore ee la geliyay waa la
  // nadiifiyaa si loo bilaabo mid cusub, isla habka AddStudent.jsx.
  function handleEditFeeCategoryChange(value) {
    setEditData({
      ...editData,
      feeCategory: value,
      feeCategoryAmount: "",
    });
  }

  // ---- Sawirka cusub: kaydi file-ka gudaha state-ka si aan u soo
  // shubno Firebase Storage marka la kaydinayo (saveEdit), preview-ga
  // oo kaliya ayaa local ah ilaa saveEdit la riixo. ----
  function handlePhotoChange(e) {
    const file = e.target.files[0];
    if (!file) return;
    setPhotoFile(file);
    setPhotoPreview(URL.createObjectURL(file));
  }

  async function saveEdit() {
    if (!editData.fullName.trim()) {
      alert("Fadlan geli Magaca Ardayga");
      return;
    }
    if (!editData.className) {
      alert("Fadlan dooro Class");
      return;
    }
    if (editData.feeType === "Paid" && !String(editData.monthlyFee).trim()) {
      alert("Fadlan geli Qiimaha Fee-ga bishii (Paid)");
      return;
    }
    // ✅ Hadii Fee Category la doortay, qiimihiisa waa waajib — isla
    // hubinta AddStudent.jsx.
    if (editData.feeCategory && !String(editData.feeCategoryAmount).trim()) {
      alert(`Fadlan geli qiimaha ${editData.feeCategory}`);
      return;
    }

    try {
      setSaving(true);

      // Haddii sawir cusub la doortay, kor u soo shub Firebase Storage
      // ka hor inta aan Firestore la kaydin, si photoUrl-ku uu noqdo
      // link toos ah oo cusub — isla habka AddStudent.jsx u shaqeeyo.
      let photoUrl = editData.studentPhoto || "";
      if (photoFile) {
        const photoRef = ref(
          storage,
          `students/${selectedStudent.studentId}/${Date.now()}_${photoFile.name}`
        );
        await uploadBytes(photoRef, photoFile);
        photoUrl = (await getDownloadURL(photoRef)).trim();
      }

      const finalMonthlyFee = editData.feeType === "Free" ? "0" : editData.monthlyFee;

      // ✅ Xogta saddexda fee ee gaarka ah — waxaa la kaydiyaa keliya
      // nooca la doortay iyo qiimihiisa (labada kale waa "0"), isla
      // habka AddStudent.jsx.
      const registrationFees =
        editData.feeCategory === "Registration Fees" ? editData.feeCategoryAmount : "0";
      const rollNumberFees =
        editData.feeCategory === "Roll Number Fees" ? editData.feeCategoryAmount : "0";
      const examinationFees =
        editData.feeCategory === "Examination Fees" ? editData.feeCategoryAmount : "0";

      const updatedFields = {
        fullName: editData.fullName,
        className: editData.className,
        feeType: editData.feeType,
        monthlyFee: finalMonthlyFee,
        feeCategory: editData.feeCategory,
        registrationFees,
        rollNumberFees,
        examinationFees,
        parentPhone: editData.parentPhone,
        studentPhone: editData.studentPhone,
        district: editData.district,
        previousSchool: editData.previousSchool,
        orphanStatus: editData.orphanStatus,
        parentPassword: editData.parentPassword,
        studentPhoto: photoUrl,
      };

      await updateDoc(doc(db, "students", selectedStudent.id), updatedFields);

      setStudents((prev) =>
        prev.map((s) =>
          s.id === selectedStudent.id ? { ...s, ...updatedFields } : s
        )
      );

      alert("Ardayga waa la cusboonaysiiyay");
      closeEdit();
    } catch (err) {
      console.log(err);
      alert(err.message);
    } finally {
      setSaving(false);
    }
  }

  // ---- Tirtirka ardayga ----
  // MUHIIM: Xogta Firestore laftigeeda LAGAMA TIRTIRO halkan. Waxaa kaliya
  // la calaamadeeyaa "pendingDeletion: true" (iyo waqtiga codsiga) si arday-gu
  // uu si toos ah uga qarsoomo liiska front-end-ka. Tirtirka dhabta ah ee
  // Firestore waxaa kaliya sameeya backend-ka marka la ansixiyo (approve).
  async function deleteStudent(student) {
    if (!confirm(`Ma hubtaa inaad tirtirto ${student.fullName}?`)) return;
    try {
      await updateDoc(doc(db, "students", student.id), {
        pendingDeletion: true,
        deletionRequestedAt: new Date().toISOString(),
      });

      setStudents((prev) =>
        prev.map((s) =>
          s.id === student.id
            ? { ...s, pendingDeletion: true, deletionRequestedAt: new Date().toISOString() }
            : s
        )
      );

      alert("SUCCESSFULLY REQUESTED FOR DELETION✅.");
    } catch (err) {
      console.log(err);
      alert(err.message);
    }
  }

  // ---- "Download PDF" — samee warqad PDF ah oo ka kooban dhammaan
  // xogta ardaygan, kadibna si toos ah u soo deji. ----
  async function handleExportPdf(student) {
    try {
      setExportingId(student.id);
      await exportStudentPdf(student);
    } finally {
      setExportingId(null);
    }
  }

  // ---- "Export Excel" — samee hal file Excel ah oo ka kooban dhammaan
  // ardayda (haddii "All Classes" la doortay) ama kaliya ardayda Class-ka
  // la doortay, kadibna si toos ah u soo deji. ----
  function handleExportExcel() {
    const activeStudents = students.filter((s) => !s.pendingDeletion);
    const targets =
      exportClassFilter === "All"
        ? activeStudents
        : activeStudents.filter((s) => s.className === exportClassFilter);

    if (targets.length === 0) {
      alert("Ma jiraan arday xog ah oo la dejin karo doorashadan.");
      return;
    }

    try {
      setExportingExcel(true);
      const fileLabel =
        exportClassFilter === "All" ? "All_Students" : exportClassFilter.trim().replace(/\s+/g, "_");
      exportStudentsToExcel(targets, `${fileLabel}.xlsx`);
    } catch (err) {
      console.log(err);
      alert("Waa la xumaaday soo saarista Excel-ka. Fadlan isku day mar kale.");
    } finally {
      setExportingExcel(false);
    }
  }

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "#0b0a1c" }}>
      <Sidebar />

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ padding: "20px 24px 0" }}>
          <Topbar title="Students" />
        </div>

        <div style={{ padding: "26px 30px" }}>
          <h1 style={{ color: "#fff", marginBottom: 22, fontSize: 26, fontWeight: 800 }}>
            Students
          </h1>

          <div style={{ display: "flex", gap: 15, marginBottom: 25, flexWrap: "wrap" }}>
            <Link to="/admin/add-student">
              <button style={purpleBtn}>
                <Plus size={17} />
                Add Student
              </button>
            </Link>

            <Link to="/admin/bulk-registration">
              <button style={ghostBtn}>
                <Upload size={17} />
                Bulk Registration
              </button>
            </Link>

            <div style={searchWrap}>
              <Search size={16} color="#8b87ad" />
              <input
                placeholder="Raadi ID-ga ama Password-ka ardayga..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                style={searchInput}
              />
            </div>

            {/* ✅ "Export Excel" — dooro Class (ama "All Classes"),
                kadibna soo deji xogtooda hal file Excel ah. */}
            <select
              value={exportClassFilter}
              onChange={(e) => setExportClassFilter(e.target.value)}
              style={exportClassSelect}
            >
              <option value="All">All Classes</option>
              {availableClasses.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>

            <button
              onClick={handleExportExcel}
              disabled={exportingExcel}
              style={{
                ...excelBtn,
                opacity: exportingExcel ? 0.7 : 1,
                cursor: exportingExcel ? "not-allowed" : "pointer",
              }}
            >
              {exportingExcel ? (
                <Loader2 size={17} style={{ animation: "spin 1s linear infinite" }} />
              ) : (
                <FileSpreadsheet size={17} />
              )}
              {exportingExcel ? "Kaydinaya..." : "Export Excel"}
            </button>
          </div>

          <div style={listCard}>
            <h3 style={{ color: "#fff", margin: "0 0 16px", fontSize: 17 }}>
              Student List{" "}
              <span style={{ color: "#8b87ad", fontWeight: 400, fontSize: 14 }}>
                ({filteredStudents.length})
              </span>
            </h3>

            {loading ? (
              <p style={{ color: "#8b87ad" }}>Loading...</p>
            ) : filteredStudents.length === 0 ? (
              <p style={{ color: "#8b87ad" }}>Wax arday ah lama helin.</p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {filteredStudents.map((student) => {
                  const photoUrl = getStudentPhotoUrl(student);
                  const isExporting = exportingId === student.id;
                  return (
                    <div key={student.id} style={studentRow}>
                      {photoUrl ? (
                        <img
                          src={photoUrl}
                          alt={student.fullName || "Student"}
                          style={{
                            width: 46,
                            height: 46,
                            minWidth: 46,
                            borderRadius: "50%",
                            objectFit: "cover",
                            display: "block",
                          }}
                          onError={(e) => {
                            // If the stored URL is broken/unreachable,
                            // fall back to the initials avatar instead
                            // of a permanently broken image icon.
                            e.currentTarget.style.display = "none";
                            e.currentTarget.nextSibling.style.display =
                              "flex";
                          }}
                        />
                      ) : null}
                      <div
                        style={{
                          width: 46,
                          height: 46,
                          minWidth: 46,
                          borderRadius: "50%",
                          background: "linear-gradient(135deg,#6d5df0,#8b6cf5)",
                          display: photoUrl ? "none" : "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          color: "#fff",
                          fontWeight: 700,
                          fontSize: 15,
                        }}
                      >
                        {(student.fullName || "?").slice(0, 2).toUpperCase()}
                      </div>

                      <div style={{ flex: 1, minWidth: 160 }}>
                        <div style={{ color: "#fff", fontWeight: 600, fontSize: 14.5 }}>
                          {student.fullName || "—"}
                        </div>
                        <div style={{ color: "#8b87ad", fontSize: 12.5, marginTop: 2 }}>
                          ID: {student.studentId || "—"}
                        </div>
                      </div>

                      <span style={tag}>Class {student.className || "—"}</span>
                      <span style={tag}>{student.studentPhone || "—"}</span>
                      <span style={tag}>${student.monthlyFee || "0"}/bishii</span>

                      <div style={{ display: "flex", gap: 8 }}>
                        <button
                          onClick={() => handleExportPdf(student)}
                          disabled={isExporting}
                          title="Download Record (PDF)"
                          style={{
                            ...iconBtnExport,
                            opacity: isExporting ? 0.6 : 1,
                            cursor: isExporting ? "not-allowed" : "pointer",
                          }}
                        >
                          {isExporting ? (
                            <Loader2 size={15} style={{ animation: "spin 1s linear infinite" }} />
                          ) : (
                            <Download size={15} />
                          )}
                        </button>
                        <button onClick={() => openEdit(student)} style={iconBtnEdit}>
                          <Pencil size={15} />
                        </button>
                        <button onClick={() => deleteStudent(student)} style={iconBtnDelete}>
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ---- Modal-ka wax-ka-bedelka ardayga ---- */}
      {editData && (
        <div style={overlay}>
          <div style={modal}>
            <div style={modalHeader}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <GraduationCap size={20} color="#8b6cf5" />
                <h2 style={{ color: "#fff", margin: 0, fontSize: 19 }}>
                  Wax ka bedel: {selectedStudent.fullName}
                </h2>
              </div>
              <button onClick={closeEdit} style={closeBtn}>
                <X size={18} />
              </button>
            </div>

            <div style={modalBody}>
              {/* ---- Sawirka ardayga ---- */}
              <div style={{ display: "flex", alignItems: "center", gap: 20, marginBottom: 26 }}>
                <label
                  htmlFor="editPhoto"
                  style={{
                    width: 88,
                    height: 88,
                    minWidth: 88,
                    borderRadius: "50%",
                    background: photoPreview
                      ? `url(${photoPreview}) center/cover`
                      : "rgba(139,108,245,0.08)",
                    border: "2px dashed #6d5df0",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    cursor: "pointer",
                    overflow: "hidden",
                  }}
                >
                  {!photoPreview && <Camera color="#8b6cf5" size={26} />}
                </label>
                <input
                  id="editPhoto"
                  type="file"
                  accept="image/*"
                  onChange={handlePhotoChange}
                  style={{ display: "none" }}
                />
                <div>
                  <div style={{ fontWeight: 700, color: "#fff", fontSize: 15 }}>
                    Sawirka Ardayga
                  </div>
                  <div style={{ color: "#8b87ad", fontSize: 13, marginTop: 4 }}>
                    Riix goobta si aad sawir cusub uga soo dooratid
                  </div>
                  <div style={{ color: "#6b6890", fontSize: 12, marginTop: 4 }}>
                    Student ID: {selectedStudent.studentId}
                  </div>
                </div>
              </div>

              <div style={grid}>
                <Field icon={User} label="Full Name">
                  <input
                    style={input}
                    value={editData.fullName}
                    onChange={(e) => handleEditChange("fullName", e.target.value)}
                  />
                </Field>

                <Field icon={School} label="Class Name">
                  <select
                    style={input}
                    value={editData.className}
                    onChange={(e) => handleEditChange("className", e.target.value)}
                  >
                    <option value="">Select Class</option>
                    {classOptions.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </Field>

                <Field icon={Wallet} label="Fee Type">
                  <select
                    style={input}
                    value={editData.feeType}
                    onChange={(e) => handleEditFeeTypeChange(e.target.value)}
                  >
                    <option value="Free">🆓 Free</option>
                    <option value="Paid">💵 Paid</option>
                  </select>
                </Field>

                {editData.feeType === "Paid" && (
                  <Field icon={Wallet} label="Monthly Fee ($)">
                    <input
                      style={input}
                      type="number"
                      value={editData.monthlyFee}
                      onChange={(e) => handleEditChange("monthlyFee", e.target.value)}
                    />
                  </Field>
                )}

                {/* ✅ Fee Category — isla saddexda doorasho AddStudent.jsx
                    isticmaalo (Registration / Roll Number / Examination) */}
                <Field icon={Receipt} label="Fee Category">
                  <select
                    style={input}
                    value={editData.feeCategory}
                    onChange={(e) => handleEditFeeCategoryChange(e.target.value)}
                  >
                    {feeCategoryOptions.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </Field>

                {editData.feeCategory && (
                  <Field icon={IdCard} label={`${editData.feeCategory} ($)`}>
                    <input
                      style={input}
                      type="number"
                      value={editData.feeCategoryAmount}
                      onChange={(e) =>
                        handleEditChange("feeCategoryAmount", e.target.value)
                      }
                    />
                  </Field>
                )}

                <Field icon={Phone} label="Parent Phone">
                  <input
                    style={input}
                    value={editData.parentPhone}
                    onChange={(e) => handleEditChange("parentPhone", e.target.value)}
                  />
                </Field>

                <Field icon={Smartphone} label="Student Phone">
                  <input
                    style={input}
                    value={editData.studentPhone}
                    onChange={(e) => handleEditChange("studentPhone", e.target.value)}
                  />
                </Field>

                <Field icon={MapPin} label="District">
                  <input
                    style={input}
                    value={editData.district}
                    onChange={(e) => handleEditChange("district", e.target.value)}
                  />
                </Field>

                <Field icon={BookOpen} label="Previous School">
                  <input
                    style={input}
                    value={editData.previousSchool}
                    onChange={(e) => handleEditChange("previousSchool", e.target.value)}
                  />
                </Field>

                <Field icon={Heart} label="Orphan Status">
                  <select
                    style={input}
                    value={editData.orphanStatus}
                    onChange={(e) => handleEditChange("orphanStatus", e.target.value)}
                  >
                    <option>No</option>
                    <option>Yes</option>
                  </select>
                </Field>

                <Field icon={Lock} label="Parent Password">
                  <input
                    style={input}
                    value={editData.parentPassword}
                    onChange={(e) => handleEditChange("parentPassword", e.target.value)}
                  />
                </Field>

                <Field icon={Hash} label="Student ID">
                  <input style={{ ...input, opacity: 0.6 }} value={selectedStudent.studentId} disabled />
                </Field>
              </div>
            </div>

            <div style={modalFooter}>
              <button onClick={closeEdit} style={cancelBtn}>
                Iska daa
              </button>
              <button onClick={saveEdit} disabled={saving} style={saveBtn}>
                {saving ? (
                  <>
                    <Loader2 size={16} style={{ animation: "spin 1s linear infinite" }} />
                    Kaydinaya...
                  </>
                ) : (
                  <>
                    <Save size={16} />
                    Kaydi Isbedelka
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        input::placeholder { color: #6b6890; }
        select option { background: #1e1a4a; color: #ffffff; }
      `}</style>
    </div>
  );
}

function Field({ icon: Icon, label: labelText, children }) {
  return (
    <div>
      <label style={label}>
        <Icon size={15} color="#8b6cf5" />
        {labelText}
      </label>
      {children}
    </div>
  );
}

const purpleBtn = {
  display: "inline-flex",
  alignItems: "center",
  gap: 8,
  background: "linear-gradient(90deg,#6d5df0,#8b6cf5)",
  color: "#fff",
  border: "none",
  padding: "12px 20px",
  borderRadius: 10,
  cursor: "pointer",
  fontWeight: 700,
  fontSize: 14,
  boxShadow: "0 8px 20px rgba(109,93,240,0.3)",
};

const ghostBtn = {
  display: "inline-flex",
  alignItems: "center",
  gap: 8,
  background: "rgba(255,255,255,0.03)",
  color: "#fff",
  border: "1.5px solid rgba(139,108,245,0.35)",
  padding: "12px 20px",
  borderRadius: 10,
  cursor: "pointer",
  fontWeight: 700,
  fontSize: 14,
};

// ✅ Dropdown-ka Class-ka loo doorto "Export Excel"
const exportClassSelect = {
  padding: "0 14px",
  height: 46,
  borderRadius: 10,
  border: "1.5px solid rgba(139,108,245,0.3)",
  background: "rgba(255,255,255,0.02)",
  color: "#e5e3f7",
  fontSize: 13.5,
  outline: "none",
  minWidth: 170,
};

// ✅ Button-ka "Export Excel"
const excelBtn = {
  display: "inline-flex",
  alignItems: "center",
  gap: 8,
  background: "linear-gradient(90deg,#16a34a,#22c55e)",
  color: "#fff",
  border: "none",
  padding: "12px 20px",
  borderRadius: 10,
  fontWeight: 700,
  fontSize: 14,
  boxShadow: "0 8px 20px rgba(34,197,94,0.3)",
};

const searchWrap = {
  display: "flex",
  alignItems: "center",
  gap: 10,
  width: 340,
  padding: "0 14px",
  borderRadius: 10,
  border: "1.5px solid rgba(139,108,245,0.3)",
  background: "rgba(255,255,255,0.02)",
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
  marginTop: 26,
  background: "linear-gradient(160deg,#1c1840,#211c48)",
  borderRadius: 16,
  padding: 22,
  border: "1px solid rgba(255,255,255,0.05)",
};

const studentRow = {
  display: "flex",
  alignItems: "center",
  gap: 16,
  padding: "12px 16px",
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

const iconBtnEdit = {
  background: "rgba(139,108,245,0.12)",
  border: "1px solid rgba(139,108,245,0.3)",
  color: "#8b6cf5",
  width: 32,
  height: 32,
  borderRadius: 8,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  cursor: "pointer",
};

const iconBtnDelete = {
  background: "rgba(239,68,68,0.12)",
  border: "1px solid rgba(239,68,68,0.3)",
  color: "#f87171",
  width: 32,
  height: 32,
  borderRadius: 8,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  cursor: "pointer",
};

// ✅ Button-ka "Download PDF" — ku xigta Edit/Delete goobta safka ardayga
const iconBtnExport = {
  background: "rgba(74,222,128,0.12)",
  border: "1px solid rgba(74,222,128,0.3)",
  color: "#4ade80",
  width: 32,
  height: 32,
  borderRadius: 8,
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
  borderRadius: 20,
  width: "100%",
  maxWidth: 780,
  maxHeight: "90vh",
  display: "flex",
  flexDirection: "column",
};

const modalHeader = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  padding: "22px 26px",
  borderBottom: "1px solid rgba(139,108,245,0.2)",
};

const closeBtn = {
  background: "rgba(255,255,255,0.05)",
  border: "none",
  color: "#fff",
  width: 32,
  height: 32,
  borderRadius: 8,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  cursor: "pointer",
};

const modalBody = {
  padding: "24px 26px",
  overflowY: "auto",
};

const modalFooter = {
  display: "flex",
  justifyContent: "flex-end",
  gap: 12,
  padding: "18px 26px",
  borderTop: "1px solid rgba(139,108,245,0.2)",
};

const cancelBtn = {
  background: "rgba(255,255,255,0.04)",
  border: "1.5px solid rgba(139,108,245,0.3)",
  color: "#fff",
  padding: "12px 22px",
  borderRadius: 10,
  cursor: "pointer",
  fontWeight: 600,
  fontSize: 14,
};

const saveBtn = {
  display: "inline-flex",
  alignItems: "center",
  gap: 8,
  background: "linear-gradient(90deg,#6d5df0,#8b6cf5)",
  color: "#fff",
  border: "none",
  padding: "12px 22px",
  borderRadius: 10,
  cursor: "pointer",
  fontWeight: 700,
  fontSize: 14,
};

const label = {
  display: "flex",
  alignItems: "center",
  gap: 7,
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

const grid = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: "20px 24px",
};