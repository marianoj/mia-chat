import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Inter } from "next/font/google";
import { Toaster } from "@/components/ui/toaster";
import { ThreadsProvider } from "@/components/agent-inbox/contexts/ThreadContext";
import React from "react";
import { SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar, AppSidebarTrigger } from "@/components/app-sidebar";
import { BreadCrumb } from "@/components/agent-inbox/components/breadcrumb";
import { cn } from "@/lib/utils";

const inter = Inter({
  subsets: ["latin"],
  preload: true,
  display: "swap",
});

export const metadata: Metadata = {
  title: "Agent Inbox",
  description: "Agent Inbox UX by LangChain",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Agent Inbox",
  },
  formatDetection: {
    telephone: false,
  },
  other: {
    "mobile-web-app-capable": "yes",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: "#000000",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <React.Suspense fallback={<div>Loading (layout)...</div>}>
          <Toaster />
          <ThreadsProvider>
            <SidebarProvider>
              <AppSidebar />
              <main className="flex flex-row w-full min-h-full pt-4 pl-4 gap-4 md:pt-6 md:pl-6 md:gap-6">
                {/* Desktop only: sidebar trigger as flex item */}
                <div className="hidden md:block">
                  <AppSidebarTrigger isOutside={true} />
                </div>
                <div className="flex flex-col gap-4 md:gap-6 w-full min-h-full">
                  {/* Mobile: trigger inline with breadcrumb */}
                  <div className="flex items-center gap-2">
                    <div className="md:hidden">
                      <AppSidebarTrigger isOutside={true} />
                    </div>
                    <BreadCrumb className="pl-0 md:pl-5" />
                  </div>
                  <div
                    className={cn(
                      "h-full bg-white rounded-tl-[32px] md:rounded-tl-[58px]",
                      "overflow-x-auto scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100"
                    )}
                  >
                    {children}
                  </div>
                </div>
              </main>
            </SidebarProvider>
          </ThreadsProvider>
        </React.Suspense>
      </body>
    </html>
  );
}
