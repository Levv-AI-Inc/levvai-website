export default function ExternalLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="levv-worker-portal min-h-screen bg-gradient-to-b from-indigo-50 via-slate-50 to-white">
      {children}
    </div>
  )
}
