import type { Metadata } from "next";
import "./globals.css";
import { ThemeProvider } from "./components/layout/ThemeProvider";
import { AuthProvider } from "./components/auth/AuthProvider";
import ToastContainer from "./components/common/Toast";

export const metadata: Metadata = {
  title: "Claudio - AI 私人 DJ",
  description: "一个有温度的 AI 音乐伴侣，懂你音乐的知己",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh" data-theme="dark" className="h-full overflow-hidden antialiased" suppressHydrationWarning>
      <body className="h-full overflow-hidden flex flex-col bg-canvas text-text-primary">
        <AuthProvider>
          <ThemeProvider>
            <main className="flex-1 overflow-hidden">{children}</main>
            <ToastContainer />
          </ThemeProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
