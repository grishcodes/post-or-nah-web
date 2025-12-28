
  import { createRoot } from "react-dom/client";
  import { BrowserRouter, Routes, Route } from 'react-router-dom';
  import App from "./App";
  import LoginPage from "./pages/LoginPage";
  import OAuthCallbackPage from "./pages/OAuthCallbackPage";
  import { AuthProvider } from './context/AuthContext';
  import "./index.css";

  createRoot(document.getElementById("root")!).render(
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/" element={<App />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/auth/callback" element={<OAuthCallbackPage />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
  