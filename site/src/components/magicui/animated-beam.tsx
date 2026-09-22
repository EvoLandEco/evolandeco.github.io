"use client";

import { useEffect, useId, useState, type RefObject } from "react";
import { motion, type MotionValue } from "motion/react";

import { cn } from "@/lib/utils";

export interface AnimatedBeamProps {
  playing?: boolean;
  glow?: boolean;
  className?: string;
  projectedPath?: MotionValue<string>;
  containerRef?: RefObject<HTMLElement | null>;
  fromRef?: RefObject<HTMLElement | null>;
  toRef?: RefObject<HTMLElement | null>;
  curvature?: number;
  reverse?: boolean;
  pathColor?: string;
  pathWidth?: number;
  pathOpacity?: number;
  gradientStartColor?: string;
  gradientStopColor?: string;
  delay?: number;
  duration?: number;
  repeat?: number;
  repeatDelay?: number;
  startXOffset?: number;
  startYOffset?: number;
  endXOffset?: number;
  endYOffset?: number;
}

export const AnimatedBeam: React.FC<AnimatedBeamProps> = ({
  className,
  playing = false,
  glow = false,
  containerRef,
  projectedPath,
  fromRef,
  toRef,
  curvature = 0,
  reverse = false, // Include the reverse prop
  duration = 5,
  delay = 0,
  pathColor = "gray",
  pathWidth = 2,
  pathOpacity = 0.2,
  gradientStartColor = "#ffaa40",
  gradientStopColor = "#9c40ff",
  repeat = Infinity,
  repeatDelay = 0,
  startXOffset = 0,
  startYOffset = 0,
  endXOffset = 0,
  endYOffset = 0,
}) => {
  const id = useId();
  const [pathD, setPathD] = useState("");
  const [svgDimensions, setSvgDimensions] = useState({ width: 0, height: 0 });

  // Calculate the gradient coordinates based on the reverse prop
  const gradientCoordinates = reverse
    ? {
        x1: projectedPath ? ["100%", "-45%"] : ["90%", "-10%"],
        x2: projectedPath ? ["145%", "0%"] : ["100%", "0%"],
        y1: ["0%", "0%"],
        y2: ["0%", "0%"],
      }
    : {
        x1: projectedPath ? ["0%", "145%"] : ["10%", "110%"],
        x2: projectedPath ? ["-45%", "100%"] : ["0%", "100%"],
        y1: ["0%", "0%"],
        y2: ["0%", "0%"],
      };

  useEffect(() => {
    if (projectedPath) return;
    const updatePath = () => {
      if (containerRef?.current && fromRef?.current && toRef?.current) {
        const containerRect = containerRef?.current.getBoundingClientRect();
        const rectA = fromRef?.current.getBoundingClientRect();
        const rectB = toRef?.current.getBoundingClientRect();

        const svgWidth = containerRect.width;
        const svgHeight = containerRect.height;
        setSvgDimensions({ width: svgWidth, height: svgHeight });

        const startX =
          rectA.left - containerRect.left + rectA.width / 2 + startXOffset;
        const startY =
          rectA.top - containerRect.top + rectA.height / 2 + startYOffset;
        const endX =
          rectB.left - containerRect.left + rectB.width / 2 + endXOffset;
        const endY =
          rectB.top - containerRect.top + rectB.height / 2 + endYOffset;

        const controlY = startY - curvature;
        const d = `M ${startX},${startY} Q ${
          (startX + endX) / 2
        },${controlY} ${endX},${endY}`;
        setPathD(d);
      }
    };

    // Initialize ResizeObserver
    const resizeObserver = new ResizeObserver(() => {
      updatePath();
    });

    // Observe the container element
    if (containerRef?.current) {
      resizeObserver.observe(containerRef?.current);
    }

    if (fromRef?.current) resizeObserver.observe(fromRef?.current);
    if (toRef?.current) resizeObserver.observe(toRef?.current);

    // Measure the shared coordinate space.
    updatePath();

    // Clean up the observer on component unmount
    return () => {
      resizeObserver.disconnect();
    };
  }, [
    projectedPath,
    containerRef,
    fromRef,
    toRef,
    curvature,
    startXOffset,
    startYOffset,
    endXOffset,
    endYOffset,
  ]);

  return (
    <svg
      aria-hidden="true"
      fill="none"
      width={projectedPath ? "100%" : svgDimensions.width}
      height={projectedPath ? "100%" : svgDimensions.height}
      xmlns="http://www.w3.org/2000/svg"
      className={cn(
        "pointer-events-none absolute top-0 left-0 transform-gpu stroke-2",
        className,
      )}
      viewBox={
        projectedPath
          ? "0 0 1000 1000"
          : `0 0 ${svgDimensions.width} ${svgDimensions.height}`
      }
    >
      <motion.path
        d={projectedPath || pathD}
        stroke={pathColor}
        strokeWidth={pathWidth}
        strokeOpacity={pathOpacity}
        strokeLinecap="round"
      />
      {playing && glow && [3.5, 1.8].map((size, i) => (
        <motion.path key={size} d={projectedPath || pathD}
          strokeWidth={pathWidth * size} stroke={`url(#${id})`}
          strokeOpacity={i === 0 ? 0.12 : 0.3} strokeLinecap="round" />
      ))}
      {playing && (
        <motion.path
          d={projectedPath || pathD}
          strokeWidth={pathWidth}
          stroke={`url(#${id})`}
          strokeOpacity="1"
          strokeLinecap="round"
        />
      )}
      {playing && (
        <defs>
          <motion.linearGradient
            className="transform-gpu"
            id={id}
            gradientUnits={projectedPath ? "objectBoundingBox" : "userSpaceOnUse"}
            initial={{
              x1: gradientCoordinates.x1[0],
              x2: gradientCoordinates.x2[0],
              y1: "0%",
              y2: "0%",
            }}
            animate={{
              x1: gradientCoordinates.x1,
              x2: gradientCoordinates.x2,
              y1: gradientCoordinates.y1,
              y2: gradientCoordinates.y2,
            }}
            transition={{
              delay,
              duration,
              ease: projectedPath ? "linear" : [0.16, 1, 0.3, 1],
              repeat,
              repeatDelay,
            }}
          >
            <stop stopColor={gradientStartColor} stopOpacity="0"></stop>
            <stop stopColor={gradientStartColor}></stop>
            <stop offset={projectedPath ? "12%" : "32.5%"} stopColor={gradientStopColor}></stop>
            <stop
              offset="100%"
              stopColor={gradientStopColor}
              stopOpacity="0"
            ></stop>
          </motion.linearGradient>
        </defs>
      )}
    </svg>
  );
};
