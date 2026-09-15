import type { Metadata } from "next";
import "./globals.css";
import "./reality.css";

export const metadata: Metadata = {
  title: "AnswerSurface · Reality Lab",
  description: "Ask a question. Get a manipulable model, not just an answer.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
