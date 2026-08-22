"use client"

import { motion, useReducedMotion } from "framer-motion"
import { ReactNode } from "react"

interface MotionWrapperProps {
  children: ReactNode
  className?: string
  delay?: number
}

export default function MotionWrapper({
  children,
  className = "",
  delay = 0,
}: MotionWrapperProps) {
  const prefersReducedMotion = useReducedMotion()

  if (prefersReducedMotion) {
    return <div className={className}>{children}</div>
  }

  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        duration: 0.25,
        ease: "easeOut",
        delay,
      }}
    >
      {children}
    </motion.div>
  )
}
