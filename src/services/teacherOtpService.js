// src/services/teacherOtpService.js
// Teacher Email OTP — isla habka admin-ka (otpService.js).
import { createOtpClient } from "./otpService";

const client = createOtpClient({
  role: "teacher",
  fns: { start: "teacherLoginStart", resend: "resendTeacherOtp", verify: "verifyTeacherOtp" },
  localKeys: ["teacherId", "teacherName", "teacherPhoto"],
  onVerified: (data) => {
    // teacherId = doc id-ga teachers/{id} — boggagga teacher-ku waxay ku akhriyaan.
    localStorage.setItem("teacherId", data.account.id);
    localStorage.setItem("teacherName", data.account.name);
    if (data.account.photo) localStorage.setItem("teacherPhoto", data.account.photo);
    return data.account;
  },
});

export const teacherOtpClient = client;
export const startTeacherLogin = client.start;
export const signOutTeacher = client.signOut;
export const getVerifiedTeacherClaims = async (user) => {
  const c = await client.getVerifiedClaims(user);
  return c && c.teacherId ? c : null;
};