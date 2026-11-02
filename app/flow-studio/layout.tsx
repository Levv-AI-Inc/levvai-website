import { Suspense, type ReactNode } from 'react';
import { FlowStudioShell } from '@flow-studio-ui/FlowStudioShell';

/** The shell lives in the layout so Test and Nova stay open when the picker moves to another workflow (04 §3.1). */
export default function FlowStudioLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <Suspense>
        <FlowStudioShell basePath="/flow-studio" variant="page" />
      </Suspense>
      {children}
    </>
  );
}
