import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./globals.css";
import { ThemeProvider } from "./components/ThemeProvider.tsx"; // Импортируем ThemeProvider

createRoot(document.getElementById("root")!).render(
  <ThemeProvider defaultTheme="dark" storageKey="vite-ui-theme"> {/* Изменено на defaultTheme="dark" */}
    <App />
  </ThemeProvider>
);