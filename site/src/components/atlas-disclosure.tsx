import { useState, type ComponentProps, type ReactNode } from "react";

export function AtlasDisclosure({ summary, children, unmountOnClose = false, ...props }: Omit<ComponentProps<"details">, "children"> & {
  summary: ReactNode; children: () => ReactNode; unmountOnClose?: boolean;
}) {
  const [loaded, setLoaded] = useState(Boolean(props.open));
  return <details {...props} onToggle={event => {
    if (event.target !== event.currentTarget) return;
    if (event.currentTarget.open || unmountOnClose) setLoaded(event.currentTarget.open);
    props.onToggle?.(event);
  }}>{summary}{loaded && children()}</details>;
}
