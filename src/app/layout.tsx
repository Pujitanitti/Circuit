import type { Metadata } from "next";
import { Sidebar } from "@/components/shell/Sidebar";
import { CommandPalette } from "@/components/command/CommandPalette";
import { ToastProvider } from "@/components/ui/Toast";
import "@/styles/globals.css";

export const metadata: Metadata = {
  title: "Circuit — agentic workflow platform",
  description: "Visually build, run, and debug agentic workflows.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <ToastProvider>
          <div className="flex h-screen w-full overflow-hidden">
            <Sidebar />
            <main className="flex-1 overflow-auto">{children}</main>
          </div>
          <CommandPalette />
        </ToastProvider>
      </body>
    </html>
  );
}
