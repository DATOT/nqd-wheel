import { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Robotics Wheel",
  description: "Một giải pháp công bằng để đưa ra lựa chọn:)",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
