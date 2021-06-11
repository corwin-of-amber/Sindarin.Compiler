import React from "react";
import ReactDOM from "react-dom";
import App from "./components/App";
import "stylesheets/global.scss";
import "stylesheets/AstPanel.scss";
import "stylesheets/EditorPanel.scss";
import "stylesheets/PegPanel.scss";
import "stylesheets/Resizer.scss";
import "stylesheets/Toolbar.scss";
import "vis-network/styles/vis-network.css";

ReactDOM.render(<App />, document.getElementById("app"));
