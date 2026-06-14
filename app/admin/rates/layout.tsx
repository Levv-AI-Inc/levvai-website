import RatesModuleLayout from './components/RatesModuleLayout'

export default function AdminRatesLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <RatesModuleLayout>{children}</RatesModuleLayout>
}
