import { Suspense, type ReactNode } from 'react';
import { EmbeddedFrame } from '@flow-studio-ui/EmbeddedFrame';
import { FlowStudioShell } from '@flow-studio-ui/FlowStudioShell';

/** Admin settings → Workflows: the same shell as /flow-studio, pinned over the admin column (decision 1). The admin layout has already checked access. */
export default function AdminWorkflowsLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <EmbeddedFrame>
        <Suspense>
          <FlowStudioShell basePath="/admin/workflows" variant="embedded" />
        </Suspense>
      </EmbeddedFrame>
      {children}
    </>
  );
}
