
  import { createRoot } from "react-dom/client";
  import { BrowserRouter, Routes, Route } from 'react-router-dom';
  import "./index.css";
  import "./styles/globals.css";

  const rootElement = document.getElementById("root");
  const bootMarker = document.getElementById('boot-marker');

  function setBootMarker(text: string) {
    if (bootMarker) bootMarker.textContent = text;
  }

  function renderStartupError(title: string, error: unknown) {
    if (!rootElement) return;
    const message = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
    rootElement.innerHTML = `
      <div style="min-height:100vh;display:flex;align-items:flex-start;justify-content:center;background:#05050f;padding:24px;font-family:Inter,system-ui,-apple-system,Segoe UI,Roboto,sans-serif;">
        <div style="width:min(920px,100%);background:rgba(248,113,113,0.08);border:1px solid rgba(248,113,113,0.3);color:#fecaca;border-radius:14px;padding:16px 18px;line-height:1.5;white-space:pre-wrap;word-break:break-word;">
          <div style="font-weight:700;color:#fca5a5;margin-bottom:8px;">${title}</div>
          <div>${message}</div>
          <div style="margin-top:10px;color:#fda4af;font-size:13px;">Open DevTools Console for full stack trace.</div>
        </div>
      </div>
    `;
  }

  if (!rootElement) {
    throw new Error('Root element #root not found');
  }

  setBootMarker('JS LOADED');

  window.addEventListener('error', (event) => {
    renderStartupError('Runtime Error', event.error ?? event.message);
  });

  window.addEventListener('unhandledrejection', (event) => {
    renderStartupError('Unhandled Promise Rejection', event.reason);
  });

  const root = createRoot(rootElement);

  async function bootstrapApp() {
    try {
      setBootMarker('LOADING MODULES');
      const [
        { default: App },
        { default: LoginPage },
        { default: OAuthCallbackPage },
        { AuthProvider },
      ] = await Promise.all([
        import('./App'),
        import('./pages/LoginPage'),
        import('./pages/OAuthCallbackPage'),
        import('./context/AuthContext'),
      ]);

      root.render(
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

      setBootMarker('APP RENDERED');
      setTimeout(() => {
        bootMarker?.remove();
      }, 1200);
    } catch (error) {
      setBootMarker('BOOT FAILED');
      renderStartupError('Module Load Error', error);
      console.error('Bootstrap failed:', error);
    }
  }

  bootstrapApp();
  