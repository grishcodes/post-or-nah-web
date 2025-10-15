
  import { createRoot } from "react-dom/client";
  import { BrowserRouter, Routes, Route } from 'react-router-dom';
  import App from "./App";
  import { AuthProvider } from './context/AuthContext';
  import "./index.css";

  createRoot(document.getElementById("root")!).render(
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/" element={<App />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
  