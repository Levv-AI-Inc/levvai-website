import { WorkerClientProvider } from './workerClient'

export default function ActAsWorkerLayout({ children }: { children: React.ReactNode }) {
  return <WorkerClientProvider>{children}</WorkerClientProvider>
}
