import React from "react";
import ReactDOM from "react-dom/client";
import { Popup } from "./Popup";
import { installExtensionColorCssVariables } from "../shared/color-vars";
import "./popup.css";

installExtensionColorCssVariables();

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <Popup />
  </React.StrictMode>,
);
