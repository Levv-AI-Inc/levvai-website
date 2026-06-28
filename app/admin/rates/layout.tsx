import RatesModuleLayout from './components/RatesModuleLayout'
import { RatesConfigProvider } from './context/RatesConfigContext'

export default function AdminRatesLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <RatesConfigProvider>
      <RatesModuleLayout>{children}</RatesModuleLayout>
    </RatesConfigProvider>
  )
}
