import type { ReactNode } from 'react'
import '@tounsoo/todae/todae.css'

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
