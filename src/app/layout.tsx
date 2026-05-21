import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "@/styles/globals.css";
import Sidebar from "@/components/layout/Sidebar";
import Header from "@/components/layout/Header";
import { ThemeProvider } from "@/components/theme-provider";
import { SidebarLayout } from "@/components/layout/SidebarLayout";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Agentis Hub",
  description: "Amazon Bedrock AgentCore management console",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  var theme = localStorage.getItem('theme');
                  if (!theme) {
                    theme = window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
                  }
                  document.documentElement.setAttribute('data-theme', theme);
                } catch (e) {
                  document.documentElement.setAttribute('data-theme', 'dark');
                }
                // Sidebar collapse state - prevent layout flash
                try {
                  var sidebarCollapsed = localStorage.getItem('sidebar-collapsed') === 'true';
                  document.documentElement.setAttribute('data-sidebar-collapsed', String(sidebarCollapsed));
                } catch (e) {
                  document.documentElement.setAttribute('data-sidebar-collapsed', 'false');
                }
              })();
            `,
          }}
        />
      </head>
      <body className={inter.className}>
        <ThemeProvider>
          <div className="flex min-h-screen">
            <Sidebar />
            <SidebarLayout>
              <Header />
              <main className="p-6">{children}</main>
            </SidebarLayout>
          </div>
        </ThemeProvider>
      </body>
    </html>
  );
}
