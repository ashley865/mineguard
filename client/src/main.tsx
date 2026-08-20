import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import { AuthProvider } from "./context/AuthContext";
import { BuyerAuthProvider } from "./context/BuyerAuthContext";
import { ContractorAuthProvider } from "./context/ContractorAuthContext";
import ErrorBoundary from "./components/ErrorBoundary";
import "./i18n";
import "./index.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ErrorBoundary>
      <BrowserRouter>
        <AuthProvider>
          <BuyerAuthProvider>
            <ContractorAuthProvider>
              <App />
            </ContractorAuthProvider>
          </BuyerAuthProvider>
        </AuthProvider>
      </BrowserRouter>
    </ErrorBoundary>
  </StrictMode>
);
