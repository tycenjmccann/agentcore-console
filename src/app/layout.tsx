import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "@/styles/globals.css";
import Sidebar from "@/components/layout/Sidebar";
import Header from "@/components/layout/Header";
import MainContent from "@/components/layout/MainContent";
import { ThemeProvider } from "@/components/theme-provider";

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
                try {
                  var sidebarCollapsed = localStorage.getItem('sidebar-collapsed');
                  if (sidebarCollapsed === 'true') {
                    document.documentElement.setAttribute('data-sidebar-collapsed', 'true');
                  } else {
                    document.documentElement.setAttribute('data-sidebar-collapsed', 'false');
                  }
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
            <MainContent>
              <Header />
              <main className="p-6">{children}</main>
            </MainContent>
          </div>
        </ThemeProvider>
      </body>
    </html>
  );
}
