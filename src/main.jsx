import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import Admin from "./Admin";
import "./styles.css";
import "./admin.css";

const isAdminRoute = window.location.pathname === "/admin" || window.location.pathname === "/admin/";
document.body.classList.toggle("admin-body", isAdminRoute);

createRoot(document.getElementById("root")).render(
  <StrictMode>
    {isAdminRoute ? <Admin /> : <App />}
  </StrictMode>,
);
