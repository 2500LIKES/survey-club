import type { Metadata } from "next";
import "./style.css";

export const metadata: Metadata = {
  title: "Survey Club",
  description: "แบบสอบถามและคะแนนสะสม"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="th"><body>{children}</body></html>;
}