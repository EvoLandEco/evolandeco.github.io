"use client";

import { cn } from "@/lib/utils";
import {
  motion,
  type MotionValue,
  useMotionValue,
  useSpring,
  useTransform,
} from "motion/react";
import { createContext, useContext, useRef, type ReactNode } from "react";

interface DockProps {
  className?: string;
  children: ReactNode;
  leading?: ReactNode;
  mobileLabel?: ReactNode;
  trailing?: ReactNode;
  animated?: boolean;
  magnification?: number;
  distance?: number;
}

interface DockIconProps {
  className?: string;
  children?: ReactNode;
}

const DEFAULT_MAGNIFICATION = 60;
const DEFAULT_DISTANCE = 100;
const BASE_SIZE = 44;
const BASE_ICON_SIZE = 20;
const ICON_SIZE_RATIO = 0.5;
const SPRING = { mass: 0.1, stiffness: 150, damping: 12 };

interface DockContextValue {
  animated: boolean;
  mouseX: MotionValue<number>;
  magnification: number;
  distance: number;
}

const DockContext = createContext<DockContextValue | null>(null);

const Dock = ({
  className,
  children,
  leading,
  mobileLabel,
  trailing,
  animated = true,
  magnification = DEFAULT_MAGNIFICATION,
  distance = DEFAULT_DISTANCE,
}: DockProps) => {
  const mouseX = useMotionValue(Infinity);

  return (
    <DockContext.Provider value={{ mouseX, magnification, distance, animated }}>
      <div className="dock-regions">
        <div className="dock-leading">{leading}</div>
        {mobileLabel && <div className="dock-page-label">{mobileLabel}</div>}
      <motion.div
        onMouseMove={(e) => mouseX.set(animated ? e.clientX : Infinity)}
        onMouseLeave={() => mouseX.set(Infinity)}
        className={cn(
          "mx-auto w-max h-full flex items-end justify-center overflow-visible rounded-full border",
          className,
        )}
      >
        {children}
      </motion.div>
        <div className="dock-trailing">{trailing}</div>
      </div>
    </DockContext.Provider>
  );
};

const DockIcon = ({ className, children }: DockIconProps) => {
  const ref = useRef<HTMLDivElement>(null);
  const context = useContext(DockContext);

  if (!context) {
    throw new Error("DockIcon must be used within a Dock component");
  }

  const { mouseX, magnification, distance, animated } = context;

  const distanceCalc = useTransform(mouseX, (val: number) => {
    const bounds = ref.current?.getBoundingClientRect() ?? { x: 0, width: 0 };
    return val - bounds.x - bounds.width / 2;
  });

  const containerSize = useSpring(
    useTransform(
      distanceCalc,
      [-distance, 0, distance],
      [BASE_SIZE, magnification, BASE_SIZE],
    ),
    SPRING,
  );
  const iconSize = useSpring(
    useTransform(
      distanceCalc,
      [-distance, 0, distance],
      [BASE_ICON_SIZE, magnification * ICON_SIZE_RATIO, BASE_ICON_SIZE],
    ),
    SPRING,
  );

  return (
    <motion.div
      ref={ref}
      style={{ width: animated ? containerSize : BASE_SIZE, height: animated ? containerSize : BASE_SIZE }}
      className={cn(
        "relative flex aspect-square items-center justify-center rounded-full shrink-0",
        className,
      )}
    >
      <motion.div
        style={{ width: animated ? iconSize : BASE_ICON_SIZE, height: animated ? iconSize : BASE_ICON_SIZE }}
        className="flex items-center justify-center"
      >
        {children}
      </motion.div>
    </motion.div>
  );
};

export { Dock, DockIcon };
export type { DockProps, DockIconProps };
