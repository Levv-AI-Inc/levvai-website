'use client'

import { usePathname } from 'next/navigation'
import MotionWrapper from '@/components/motion/MotionWrapper'

export default function GuidedLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const pathname = usePathname()

  return (
    <MotionWrapper key={pathname}>
      {children}
    </MotionWrapper>
  )
}
