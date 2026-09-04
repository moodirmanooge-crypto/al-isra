import { useState, useEffect, useMemo } from "react";
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
  UserPlus,
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
  Loader2,
  Clock,
  Receipt,
  IdCard,
  Plus,
  Users,
  Cake,
  CalendarDays,
} from "lucide-react";

// ✅ Import-ka Logo-da Iskuulka
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

const feeCategoryOptions = [
  { value: "", label: "Select Fee Category (Optional)" },
  { value: "Registration Fees", label: "Registration Fees" },
  { value: "Roll Number Fees", label: "Roll Number Fees" },
  { value: "Examination Fees", label: "Examination Fees" },
];

const normalizeClassName = (name) => name.trim().replace(/\s+/g, " ").toLowerCase();

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

export default function AddStudent() {
  const [student, setStudent] = useState({
    fullName: "",
    motherName: "",
    gender: "",
    placeOfBirth: "",
    dateOfBirth: "",
    age: "",
    className: "",
    shift: "",
    feeType: "Free",
    monthlyFee: "",
    feeCategory: "",
    feeCategoryAmount: "",
    parentPhone: "",
    studentPhone: "",
    district: "",
    hasPreviousSchool: "No",
    previousSchool: "",
    orphanStatus: "No",
    parentPassword: "",
    studentPhoto: null,
  });

  const [photoPreview, setPhotoPreview] = useState(null);
  const [saving, setSaving] = useState(false);
  const [customClasses, setCustomClasses] = useState([]);
  const [creatingClass, setCreatingClass] = useState(false);

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
      .filter((name) => !classOptions.some((c) => normalizeClassName(c) === normalizeClassName(name)))
      .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
    return [...classOptions, ...customNames];
  }, [customClasses]);

  const handleChange = (e) => {
    setStudent({
      ...student,
      [e.target.name]: e.target.value,
    });
  };

  const handleDateOfBirthChange = (e) => {
    const value = e.target.value;
    setStudent((prev) => ({
      ...prev,
      dateOfBirth: value,
      age: calculateAge(value),
    }));
  };

  const handleFeeTypeChange = (e) => {
    const value = e.target.value;
    setStudent({
      ...student,
      feeType: value,
      monthlyFee: value === "Free" ? "0" : student.monthlyFee,
    });
  };

  const handleFeeCategoryChange = (e) => {
    const value = e.target.value;
    setStudent({
      ...student,
      feeCategory: value,
      feeCategoryAmount: "",
    });
  };

  const handlePreviousSchoolToggle = (value) => {
    setStudent({
      ...student,
      hasPreviousSchool: value,
      previousSchool: value === "No" ? "" : student.previousSchool,
    });
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    setStudent({
      ...student,
      studentPhoto: file,
    });
    if (file) {
      setPhotoPreview(URL.createObjectURL(file));
    }
  };

  const handlePhoneChange = (e) => {
    const { name, value } = e.target;
    const digitsOnly = value.replace(/[^0-9]/g, "");
    setStudent({
      ...student,
      [name]: digitsOnly,
    });
  };

  const handleCreateClass = async () => {
    const raw = window.prompt("Fadlan geli magaca Class-ka cusub:");
    if (raw === null) return;
    const trimmed = raw.trim();
    if (!trimmed) {
      alert("Fadlan geli magac sax ah oo Class-ka cusub ah");
      return;
    }

    const target = normalizeClassName(trimmed);
    const alreadyExists = allClassOptions.some(
      (c) => normalizeClassName(c) === target
    );
    if (alreadyExists) {
      alert(`Class-ka "${trimmed}" horeyba u jiray. Waxaa lagu doortay.`);
      setStudent((prev) => ({ ...prev, className: trimmed }));
      return;
    }

    try {
      setCreatingClass(true);
      const newDocRef = doc(collection(db, "customClasses"));
      await setDoc(newDocRef, {
        name: trimmed,
        createdAt: new Date(),
      });

      setCustomClasses((prev) => [...prev, { id: newDocRef.id, name: trimmed }]);
      setStudent((prev) => ({ ...prev, className: trimmed }));
    } catch (err) {
      console.log(err);
      alert(err.message);
    } finally {
      setCreatingClass(false);
    }
  };

  const normalizeName = (name) =>
    name.trim().replace(/\s+/g, " ").toLowerCase();

  const isDuplicateFullName = async (fullName) => {
    const target = normalizeName(fullName);
    if (!target) return false;
    const existingSnap = await getDocs(collection(db, "students"));
    return existingSnap.docs.some((docSnap) => {
      const existingName = docSnap.data().fullName || "";
      return normalizeName(existingName) === target;
    });
  };

  const attachStudentToClassTeachers = async (className, studentId, fullName) => {
    const teachersSnap = await getDocs(collection(db, "teachers"));

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

  const saveStudent = async () => {
    try {
      if (!student.fullName.trim()) {
        alert("Fadlan geli Magaca Ardayga");
        return;
      }

      if (!student.motherName.trim()) {
        alert("Fadlan geli Magaca Hooyada");
        return;
      }

      if (!student.gender) {
        alert("Fadlan dooro Gender-ka Ardayga (Male/Female)");
        return;
      }

      if (!student.className) {
        alert("Fadlan dooro Class");
        return;
      }

      if (student.feeType === "Paid" && !String(student.monthlyFee).trim()) {
        alert("Fadlan geli Qiimaha Fee-ga bishii (Paid)");
        return;
      }

      if (student.feeCategory && !String(student.feeCategoryAmount).trim()) {
        alert(`Fadlan geli qiimaha ${student.feeCategory}`);
        return;
      }

      if (student.hasPreviousSchool === "Yes" && !student.previousSchool.trim()) {
        alert("Fadlan geli magaca Dugsiga Hore");
        return;
      }

      if (student.parentPhone && !/^\d+$/.test(student.parentPhone)) {
        alert("Parent Phone waa inuu ahaadaa lambar keliya (numbers only)");
        return;
      }

      if (student.studentPhone && !/^\d+$/.test(student.studentPhone)) {
        alert("Student Phone waa inuu ahaadaa lambar keliya (numbers only)");
        return;
      }

      setSaving(true);

      const duplicate = await isDuplicateFullName(student.fullName);
      if (duplicate) {
        alert(
          `Arday hore ayaa loo diiwaan geliyay magacan "${student.fullName}". Fadlan isticmaal magac kale ama hubi in ardaygan horey loo diiwaan gelin.`
        );
        setSaving(false);
        return;
      }

      const existingSnap = await getDocs(collection(db, "students"));
      const studentId = String(existingSnap.size + 1).padStart(4, "0");

      // ✅ HADII SAWIR LA CHOOSE GAREYN WAAYO, TOOS LOGO-DA ISKUULKA AYAA U QAADANAYA
      let photoURL = schoolLogo;
      if (student.studentPhoto) {
        const photoRef = ref(
          storage,
          `students/${studentId}/${Date.now()}_${student.studentPhoto.name}`
        );
        await uploadBytes(photoRef, student.studentPhoto);
        photoURL = await getDownloadURL(photoRef);
      }

      const finalMonthlyFee = student.feeType === "Free" ? "0" : student.monthlyFee;

      const registrationFees =
        student.feeCategory === "Registration Fees" ? student.feeCategoryAmount : "0";
      const rollNumberFees =
        student.feeCategory === "Roll Number Fees" ? student.feeCategoryAmount : "0";
      const examinationFees =
        student.feeCategory === "Examination Fees" ? student.feeCategoryAmount : "0";

      const finalAge = calculateAge(student.dateOfBirth);

      await setDoc(doc(db, "students", studentId), {
        studentId,
        fullName: student.fullName,
        motherName: student.motherName,
        gender: student.gender,
        placeOfBirth: student.placeOfBirth,
        dateOfBirth: student.dateOfBirth,
        age: finalAge,
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
        motherName: student.motherName,
        gender: student.gender,
        placeOfBirth: student.placeOfBirth,
        dateOfBirth: student.dateOfBirth,
        age: finalAge,
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

      await attachStudentToClassTeachers(
        student.className,
        studentId,
        student.fullName
      );

      alert("Student Saved Successfully: " + student.fullName + "\nStudent ID: " + studentId);

      setStudent({
        fullName: "",
        motherName: "",
        gender: "",
        placeOfBirth: "",
        dateOfBirth: "",
        age: "",
        className: "",
        shift: "",
        feeType: "Free",
        monthlyFee: "",
        feeCategory: "",
        feeCategoryAmount: "",
        parentPhone: "",
        studentPhone: "",
        district: "",
        hasPreviousSchool: "No",
        previousSchool: "",
        orphanStatus: "No",
        parentPassword: "",
        studentPhoto: null,
      });
      setPhotoPreview(null);
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
          maxWidth: 1220,
          margin: "0 auto",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 24, marginBottom: 36 }}>
          <label
            htmlFor="studentPhoto"
            style={{
              width: 110,
              height: 110,
              minWidth: 110,
              borderRadius: "50%",
              background: photoPreview
                ? `url(${photoPreview}) center/cover`
                : "rgba(139,108,245,0.08)",
              border: student.studentPhoto
                ? "2px solid #6d5df0"
                : "2px dashed rgba(139,108,245,0.4)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              overflow: "hidden",
            }}
          >
            {!photoPreview && <Camera color="#8b6cf5" size={30} />}
          </label>
          <input
            id="studentPhoto"
            type="file"
            accept="image/*"
            onChange={handleFileChange}
            style={{ display: "none" }}
          />

          <div>
            <div style={{ fontWeight: 700, color: "#fff", fontSize: 22 }}>
              Sawirka Ardayga{" "}
              <span style={{ color: "#8b87ad", fontWeight: 400, fontSize: 14 }}>
                (ikhtiyaari)
              </span>
            </div>
            <div style={{ color: "#8b87ad", fontSize: 14, marginTop: 6 }}>
              Riix goobta si aad sawir uga soo dooratid (Hadii aad ka fasho toos waxaa loo adeegsanayaa Logo-da Iskuulka)
            </div>
          </div>
        </div>

        <div style={grid}>
          <Field icon={User} label="Full Name">
            <input
              style={input}
              name="fullName"
              placeholder="Tusaale: Ahmed Cali"
              value={student.fullName}
              onChange={handleChange}
            />
          </Field>

          <Field icon={User} label="Mother Name">
            <input
              style={input}
              name="motherName"
              placeholder="Tusaale: Faadumo Xasan"
              value={student.motherName}
              onChange={handleChange}
            />
          </Field>

          <Field icon={Users} label="Gender">
            <select
              style={input}
              name="gender"
              value={student.gender}
              onChange={handleChange}
            >
              <option value="">Select Gender</option>
              <option value="Male">👦 Male</option>
              <option value="Female">👧 Female</option>
            </select>
          </Field>

          <Field icon={MapPin} label="Place of Birth">
            <input
              style={input}
              name="placeOfBirth"
              placeholder="Tusaale: Mogadishu"
              value={student.placeOfBirth}
              onChange={handleChange}
            />
          </Field>

          <Field icon={Cake} label="Date of Birth">
            <input
              style={input}
              type="date"
              name="dateOfBirth"
              value={student.dateOfBirth}
              onChange={handleDateOfBirthChange}
              max={new Date().toISOString().slice(0, 10)}
            />
          </Field>

          <Field icon={CalendarDays} label="Age">
            <input
              style={{ ...input, opacity: 0.85, cursor: "not-allowed" }}
              type="text"
              name="age"
              placeholder="Waxa loo buuxinayaa marka Date of Birth la geliyo"
              value={student.age ? `${student.age} sano` : ""}
              readOnly
            />
          </Field>

          <Field icon={School} label="Class Name">
            <div style={{ display: "flex", gap: 10 }}>
              <select
                style={{ ...input, flex: 1 }}
                name="className"
                value={student.className}
                onChange={handleChange}
              >
                <option value="">Select Class</option>
                {allClassOptions.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={handleCreateClass}
                disabled={creatingClass}
                title="Create Class"
                style={{
                  ...createClassBtn,
                  opacity: creatingClass ? 0.7 : 1,
                  cursor: creatingClass ? "not-allowed" : "pointer",
                }}
              >
                {creatingClass ? (
                  <Loader2 size={18} style={{ animation: "spin 1s linear infinite" }} />
                ) : (
                  <Plus size={18} />
                )}
              </button>
            </div>
          </Field>

          <Field icon={Clock} label="Shift">
            <select
              style={input}
              name="shift"
              value={student.shift}
              onChange={handleChange}
            >
              <option value="">Select Shift</option>
              <option value="Morning">🌅 Morning</option>
              <option value="Afternoon">🌇 Afternoon</option>
            </select>
          </Field>

          <Field icon={Wallet} label="Fee Type">
            <select
              style={input}
              name="feeType"
              value={student.feeType}
              onChange={handleFeeTypeChange}
            >
              <option value="Free">🆓 Free</option>
              <option value="Paid">💵 Paid</option>
            </select>
          </Field>

          {student.feeType === "Paid" && (
            <Field icon={Wallet} label="Monthly Fee ($)">
              <input
                style={input}
                type="number"
                name="monthlyFee"
                placeholder="0.00"
                value={student.monthlyFee}
                onChange={handleChange}
              />
            </Field>
          )}

          <Field icon={Receipt} label="Fee Category (Optional)">
            <select
              style={input}
              name="feeCategory"
              value={student.feeCategory}
              onChange={handleFeeCategoryChange}
            >
              {feeCategoryOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </Field>

          {student.feeCategory && (
            <Field icon={IdCard} label={`${student.feeCategory} ($)`}>
              <input
                style={input}
                type="number"
                name="feeCategoryAmount"
                placeholder="0.00"
                value={student.feeCategoryAmount}
                onChange={handleChange}
              />
            </Field>
          )}

          <Field icon={Phone} label="Parent Phone">
            <input
              style={input}
              name="parentPhone"
              type="tel"
              inputMode="numeric"
              pattern="[0-9]*"
              placeholder="61xxxxxxx"
              value={student.parentPhone}
              onChange={handlePhoneChange}
            />
          </Field>

          <Field icon={Smartphone} label="Student Phone">
            <input
              style={input}
              name="studentPhone"
              type="tel"
              inputMode="numeric"
              pattern="[0-9]*"
              placeholder="61xxxxxxx"
              value={student.studentPhone}
              onChange={handlePhoneChange}
            />
          </Field>

          <Field icon={MapPin} label="District">
            <input
              style={input}
              name="district"
              placeholder="Tusaale: Hodan"
              value={student.district}
              onChange={handleChange}
            />
          </Field>

          <Field icon={BookOpen} label="Previous School">
            <div style={{ display: "flex", gap: 10 }}>
              <button
                type="button"
                onClick={() => handlePreviousSchoolToggle("Yes")}
                style={
                  student.hasPreviousSchool === "Yes" ? toggleBtnActive : toggleBtn
                }
              >
                Yes
              </button>
              <button
                type="button"
                onClick={() => handlePreviousSchoolToggle("No")}
                style={
                  student.hasPreviousSchool === "No" ? toggleBtnActive : toggleBtn
                }
              >
                No
              </button>
            </div>
          </Field>

          {student.hasPreviousSchool === "Yes" && (
            <Field icon={BookOpen} label="Magaca Dugsiga Hore">
              <input
                style={input}
                name="previousSchool"
                placeholder="Magaca dugsiga hore"
                value={student.previousSchool}
                onChange={handleChange}
              />
            </Field>
          )}

          <Field icon={Heart} label="Orphan Status">
            <select
              style={input}
              name="orphanStatus"
              value={student.orphanStatus}
              onChange={handleChange}
            >
              <option>No</option>
              <option>Yes</option>
            </select>
          </Field>

          <Field icon={Lock} label="Parent Password">
            <input
              style={input}
              type="password"
              name="parentPassword"
              placeholder="••••••••"
              value={student.parentPassword}
              onChange={handleChange}
            />
          </Field>
        </div>

        <button
          onClick={saveStudent}
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
              <UserPlus size={18} />
              Complete Registration
            </>
          )}
        </button>
      </div>

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
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

function Field({ icon: Icon, label, children }) {
  return (
    <div>
      <label
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          fontWeight: 600,
          marginBottom: 10,
          color: "#fff",
          fontSize: 15,
        }}
      >
        <Icon size={17} color="#8b6cf5" />
        {label}
      </label>
      {children}
    </div>
  );
}

const grid = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: "24px 32px",
  marginBottom: 34,
};

const input = {
  width: "100%",
  padding: "14px 16px",
  boxSizing: "border-box",
  border: "1.5px solid rgba(139,108,245,0.35)",
  borderRadius: 12,
  fontSize: 14.5,
  color: "#e5e3f7",
  outline: "none",
  background: "rgba(255,255,255,0.02)",
  transition: "border-color .2s",
};

const btnPrimary = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 10,
  background: "linear-gradient(90deg,#6d5df0,#8b6cf5)",
  color: "#fff",
  border: "none",
  borderRadius: 14,
  padding: "16px 28px",
  fontWeight: 700,
  fontSize: 15,
  boxShadow: "0 10px 24px rgba(109,93,240,0.35)",
};

const toggleBtn = {
  flex: 1,
  padding: "14px 16px",
  borderRadius: 12,
  border: "1.5px solid rgba(139,108,245,0.35)",
  background: "rgba(255,255,255,0.02)",
  color: "#8b87ad",
  fontWeight: 600,
  fontSize: 14.5,
  cursor: "pointer",
  transition: "all .2s",
};

const toggleBtnActive = {
  ...toggleBtn,
  background: "linear-gradient(90deg,#6d5df0,#8b6cf5)",
  border: "1.5px solid #6d5df0",
  color: "#fff",
};

const createClassBtn = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  minWidth: 48,
  background: "linear-gradient(90deg,#6d5df0,#8b6cf5)",
  color: "#fff",
  border: "none",
  borderRadius: 12,
  boxShadow: "0 8px 18px rgba(109,93,240,0.3)",
};