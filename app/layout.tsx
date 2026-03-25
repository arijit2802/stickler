import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Stickler — Your Personal Learning Feed",
  description:
    "Grow your knowledge breadth and depth through curated blog reading.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
