export const metadata = { title: 'AEO Lab' }

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body style={{ fontFamily: 'system-ui, sans-serif', margin: 0 }}>
        <div style={{ padding: 16, maxWidth: 1100, margin: '0 auto' }}>
          <h1 style={{ marginBottom: 8 }}>AEO Counterfactual Impact Lab</h1>
          <nav style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
            <a href="/">Runs</a>
            <a href="/queries/manage">Queries</a>
            <a href="/login">Login</a>
          </nav>
          {children}
        </div>
      </body>
    </html>
  )
}
