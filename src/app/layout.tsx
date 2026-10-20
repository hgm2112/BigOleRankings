import type { Metadata, Viewport } from "next"
import { Geist_Mono } from "next/font/google"
import localFont from "next/font/local"
import "./globals.css"

const baiJamjuree = localFont({
  src: [
    { path: "../../fonts/BaiJamjuree-ExtraLight.ttf", weight: "200", style: "normal" },
    { path: "../../fonts/BaiJamjuree-Light.ttf", weight: "300", style: "normal" },
    { path: "../../fonts/BaiJamjuree-Regular.ttf", weight: "400", style: "normal" },
    { path: "../../fonts/BaiJamjuree-Medium.ttf", weight: "500", style: "normal" },
    { path: "../../fonts/BaiJamjuree-SemiBold.ttf", weight: "600", style: "normal" },
    { path: "../../fonts/BaiJamjuree-Bold.ttf", weight: "700", style: "normal" },
    { path: "../../fonts/BaiJamjuree-Italic.ttf", weight: "400", style: "italic" },
    { path: "../../fonts/BaiJamjuree-MediumItalic.ttf", weight: "500", style: "italic" },
    { path: "../../fonts/BaiJamjuree-SemiBoldItalic.ttf", weight: "600", style: "italic" },
    { path: "../../fonts/BaiJamjuree-BoldItalic.ttf", weight: "700", style: "italic" },
  ],
  variable: "--font-bai-jamjuree",
  display: "swap",
})
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] })

export const metadata: Metadata = {
  title: "BigOleRankings",
  description: "Rate and compare movies and TV shows",
  other: {
    "apple-mobile-web-app-capable": "yes",
    "apple-mobile-web-app-status-bar-style": "default",
    "apple-mobile-web-app-title": "BigOleRankings",
  },
}

export const viewport: Viewport = {
  themeColor: "#5C00C6",
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className={`${baiJamjuree.variable} ${geistMono.variable} font-sans antialiased`}>
        {children}
      </body>
    </html>
  )
}
