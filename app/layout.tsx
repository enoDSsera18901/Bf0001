import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AnswerSurface",
  description: "Ask a question. Get the right interface.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
