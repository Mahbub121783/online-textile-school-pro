// Force HMR refresh
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import "./i18n";
import { initSecurity } from "./lib/security";

initSecurity();

createRoot(document.getElementById("root")!).render(<App />);
