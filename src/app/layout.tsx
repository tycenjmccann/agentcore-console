import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "@/styles/globals.css";
import Sidebar from "@/components/layout/Sidebar";
import Header from "@/components/layout/Header";
import { ThemeProvider } from "@/components/theme-provider";
import { SidebarProvider } from "@/components/layout/sidebar/SidebarContext";
import MainContent from "@/components/layout/MainContent";

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
            __html: `(function(){var stored=null;try{stored=localStorage.getItem('theme-preference')}catch(e){}var preference=stored||'system';var theme;if(preference==='system'){theme=window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'}else{theme=preference}document.documentElement.setAttribute('data-theme',theme);try{if(localStorage.getItem('sidebar-collapsed')==='true'){document.documentElement.setAttribute('data-sidebar-collapsed','true')}}catch(e){}})();`,
          }}
        />
      </head>
      <body className={inter.className}>
        <ThemeProvider>
          <SidebarProvider>
            <div className="flex min-h-screen">
              <Sidebar />
              <MainContent>
                <Header />
                <main className="p-6">{children}</main>
              </MainContent>
            </div>
          </SidebarProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
