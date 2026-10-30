import type { Metadata } from "next";
import "./globals.css";
import "./personal.css";
import "./companion.css";
import "./photos.css";

export const metadata: Metadata = {
  icons: { icon: "/togetherly-mark.svg" },
  title: "Togetherly | Because relationships deserve remembering.",
  description:
    "Because relationships deserve remembering. A private family space for meaningful memories, conversation, and your own voice.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
