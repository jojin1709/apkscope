import './globals.css';
import type { Metadata } from 'next';
export const metadata: Metadata={title:'APKScope — Android App Finder for Security Research',description:'Find Android app builds, versions and source download links without login.'};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="en"><body>{children}</body></html>}
