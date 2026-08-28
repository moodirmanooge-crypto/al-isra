import Sidebar from "./Sidebar";
import { Outlet } from "react-router-dom";
import { theme, fontImport } from "./theme.js";

export default function Layout() {
  return (
    <div style={{ display: "flex", fontFamily: theme.font.body }}>
      <link rel="stylesheet" href={fontImport} />
      <Sidebar />

      <div
        style={{
          flex: 1,
          padding: 32,
          background: theme.colors.surface,
          minHeight: "100vh",
        }}
      >
        <Outlet />
      </div>
    </div>
  );
}