// Magic UI community Shiny Button (MIT). See LICENSE-MAGICUI.md.
// Source: https://magicui.design/r/shiny-button.json
// Upstream SHA-256: 916c8b8ffe1a018b560dff80aed78cdfaeded889bcbec70e3fe34618d5073abf
"use client"

import React from "react"
import { motion, type MotionProps } from "motion/react"

import { cn } from "@/lib/utils"

const animationProps: MotionProps = {
  initial: { "--x": "100%", scale: 0.8 },
  animate: { "--x": "-100%", scale: 1 },
  whileTap: { scale: 0.95 },
  transition: {
    repeat: Infinity,
    repeatType: "loop",
    repeatDelay: 1,
    type: "spring",
    stiffness: 20,
    damping: 15,
    mass: 2,
    scale: {
      type: "spring",
      stiffness: 200,
      damping: 5,
      mass: 0.5,
    },
  },
}

interface ShinyButtonProps
  extends
    Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, keyof MotionProps>,
    MotionProps {
  playing?: boolean
  children: React.ReactNode
  className?: string
}

export const ShinyButton = React.forwardRef<
  HTMLAnchorElement,
  ShinyButtonProps
>(({ children, className, playing = false, ...props }, ref) => {
  return (
    <motion.a
      ref={ref}
      className={cn(
        "relative inline-flex items-center justify-center rounded-xl border px-4 py-3 font-medium",
        className
      )}
      {...(playing ? animationProps : { initial: false, animate: { "--x": "100%", scale: 1 }, transition: { duration: 0 } })}
      {...props}
    >
      <span
        className="relative block size-full text-sm tracking-wide text-foreground"
        style={{
          maskImage:
            "linear-gradient(-75deg,var(--primary) calc(var(--x) + 20%),transparent calc(var(--x) + 30%),var(--primary) calc(var(--x) + 100%))",
        }}
      >
        {children}
      </span>
      <span
        style={{
          mask: "linear-gradient(rgb(0,0,0), rgb(0,0,0)) content-box exclude,linear-gradient(rgb(0,0,0), rgb(0,0,0))",
          WebkitMask:
            "linear-gradient(rgb(0,0,0), rgb(0,0,0)) content-box exclude,linear-gradient(rgb(0,0,0), rgb(0,0,0))",
          backgroundImage:
            "linear-gradient(-75deg,color-mix(in srgb, var(--primary) 10%, transparent) calc(var(--x) + 20%),color-mix(in srgb, var(--primary) 50%, transparent) calc(var(--x) + 25%),color-mix(in srgb, var(--primary) 10%, transparent) calc(var(--x) + 100%))",
        }}
        className="absolute inset-0 z-10 block rounded-[inherit] p-px"
      />
    </motion.a>
  )
})

ShinyButton.displayName = "ShinyButton"
