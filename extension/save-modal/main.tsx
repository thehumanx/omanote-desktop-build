import React from "react";
import ReactDOM from "react-dom/client";
import { SaveModal } from "./SaveModal";
import { installExtensionColorCssVariables } from "../shared/color-vars";

installExtensionColorCssVariables();

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <SaveModal />
  </React.StrictMode>,
);
