import avatar from "../assets/avatar.png";

export default function ProfileCard() {
  return (
    <div
      style={{
        background: "#0F172A",
        borderRadius: 24,
        color: "#fff",
        padding: 25,
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
      }}
    >
      <div
        style={{
          display: "flex",
          gap: 18,
          alignItems: "center",
        }}
      >
        <img
          src={avatar}
          alt=""
          style={{
            width: 75,
            height: 75,
            borderRadius: "50%",
          }}
        />

        <div>
          <h2
            style={{
              margin: 0,
            }}
          >
            Admin User
          </h2>

          <p
            style={{
              color: "#94A3B8",
              marginTop: 8,
            }}
          >
            Super Admin
          </p>
        </div>
      </div>

      <button
        style={{
          border: "none",
          background: "#DC2626",
          color: "#fff",
          padding: "12px 24px",
          borderRadius: 12,
          cursor: "pointer",
          fontWeight: "bold",
        }}
      >
        Logout
      </button>
    </div>
  );
}