import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AI CV Copilot | Build your first professional CV",
  description: "A guided CV interview for students and fresh graduates.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
