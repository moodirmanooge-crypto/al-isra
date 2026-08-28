import { useState } from "react";
import { db } from "../../firebase/firebase";

import {
  doc,
  getDoc,
  setDoc,
  serverTimestamp,
} from "firebase/firestore";

export default function AddCashier() {
  const [fullName, setFullName] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");

  const [loading, setLoading] = useState(false);

  const saveCashier = async () => {
    if (
      fullName === "" ||
      username === "" ||
      password === "" ||
      phone === ""
    ) {
      alert("Please fill all required fields.");
      return;
    }

    try {
      setLoading(true);

      const cashierRef = doc(db, "cashier", username);

      const exists = await getDoc(cashierRef);

      if (exists.exists()) {
        alert("Username already exists.");
        setLoading(false);
        return;
      }

      await setDoc(cashierRef, {
        fullName,
        username,
        password,
        phone,
        email,

        status: "Active",

        createdAt: serverTimestamp(),
      });

      alert("Cashier Added Successfully");

      setFullName("");
      setUsername("");
      setPassword("");
      setPhone("");
      setEmail("");
    } catch (error) {
      console.log(error);
      alert(error.message);
    }

    setLoading(false);
  };

  return (
    <div
      style={{
        padding: 30,
        background: "#f5f7fb",
        minHeight: "100vh",
      }}
    >
      <h1
        style={{
          color: "#0b6b45",
          marginBottom: 25,
        }}
      >
        Add Cashier
      </h1>

      <div
        style={{
          maxWidth: 700,
          background: "#fff",
          padding: 30,
          borderRadius: 15,
          boxShadow: "0 10px 30px rgba(0,0,0,.08)",
        }}
      >
        <div style={{ marginBottom: 20 }}>
          <label>Full Name</label>

          <input
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="Cashier Full Name"
            style={input}
          />
        </div>

        <div style={{ marginBottom: 20 }}>
          <label>Username</label>

          <input
            value={username}
            onChange={(e) =>
              setUsername(
                e.target.value
                  .replace(/\s/g, "")
                  .toLowerCase()
              )
            }
            placeholder="cashier001"
            style={input}
          />
        </div>

        <div style={{ marginBottom: 20 }}>
          <label>Password</label>

          <input
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            style={input}
          />
        </div>

        <div style={{ marginBottom: 20 }}>
          <label>Phone Number</label>

          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="61xxxxxxx"
            style={input}
          />
        </div>

        <div style={{ marginBottom: 30 }}>
          <label>Email (Optional)</label>

          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="cashier@gmail.com"
            style={input}
          />
        </div>

        <button
          onClick={saveCashier}
          disabled={loading}
          style={{
            background: "#0b6b45",
            color: "#fff",
            border: "none",
            padding: "15px 35px",
            borderRadius: 10,
            fontSize: 17,
            cursor: "pointer",
          }}
        >
          {loading ? "Saving..." : "Save Cashier"}
        </button>
      </div>
    </div>
  );
}

const input = {
  width: "100%",
  padding: 13,
  marginTop: 7,
  borderRadius: 8,
  border: "1px solid #ccc",
  fontSize: 16,
};