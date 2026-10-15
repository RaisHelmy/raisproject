import "./demo/clock";
import { createRoot } from "react-dom/client";
import "bootstrap/dist/css/bootstrap.min.css";
import "./styles.css";
import "./theme";
import App from "./App";
import { Ads } from "./Ads";

const ads = location.pathname.replace(/\/+$/, "") === "/ads";
createRoot(document.getElementById("root")!).render(ads ? <Ads /> : <App />);
