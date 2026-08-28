// src/pages/TeacherVerify.jsx
// Public page a Teacher ID card's QR code links to. Reads the teacher's
// snapshot straight from `teacher_id/{teacherUsername}` (the same
// persistent record TeacherIdCard.jsx creates at issue time) and renders
// the exact same front + back card design — no login required.

import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../firebase/firebase";
import TeacherIdCard from "../teacher/TeacherIdCard";

export default function TeacherVerify() {
  const { teacherUsername } = useParams();
  const [teacher, setTeacher] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const snap = await getDoc(doc(db, "teacher_id", teacherUsername));
        if (snap.exists()) {
          setTeacher(snap.data());
        } else {
          setNotFound(true);
        }
      } catch (err) {
        console.error("Failed to load teacher ID card:", err);
        setNotFound(true);
      } finally {
        setLoading(false);
      }
    }
    if (teacherUsername) load();
  }, [teacherUsername]);

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#0b1120",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "30px 16px",
      }}
    >
      {loading ? (
        <p style={{ color: "#8b97b0", fontSize: 14 }}>Loading...</p>
      ) : notFound ? (
        <div style={{ textAlign: "center", color: "#fff" }}>
          <h2 style={{ margin: 0, fontSize: 20 }}>ID Card lama helin</h2>
          <p style={{ color: "#8b97b0", fontSize: 13.5, marginTop: 8 }}>
            Username-kan macallinka lama helin xogta school-ka.
          </p>
        </div>
      ) : (
        <>
          <div style={{ color: "#fff", marginBottom: 8, fontSize: 13, opacity: 0.7 }}>
            Al Isra School — Official Teacher ID Verification
          </div>
          <TeacherIdCard
            teacher={teacher}
            teacherUsername={teacherUsername}
            readOnly
          />
        </>
      )}
    </div>
  );
}