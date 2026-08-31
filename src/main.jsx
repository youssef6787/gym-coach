import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import "./index.css";
import "./ProductionPolish.css";
import "./ClientPortalTheme.css";
import "./TrainerPlatformTheme.css";
import "./Phase4Polish.css";


import App from "./App.jsx";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <App />
  </StrictMode>
);