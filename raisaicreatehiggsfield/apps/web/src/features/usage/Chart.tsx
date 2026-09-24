import { useEffect, useRef } from "react";
import Highcharts, { type Options } from "highcharts";

/**
 * Thin Highcharts wrapper.
 *
 * Written directly against the Highcharts API rather than using
 * highcharts-react-official, whose CommonJS default export resolves to a module
 * object under this bundler and renders as an invalid element type. This is
 * fewer moving parts and one less dependency.
 */
export function Chart(props: { options: Options; title: string; height?: number }) {
  const container = useRef<HTMLDivElement>(null);
  const chart = useRef<Highcharts.Chart | null>(null);

  useEffect(() => {
    if (!container.current) return;
    chart.current = Highcharts.chart(container.current, props.options);
    return () => {
      chart.current?.destroy();
      chart.current = null;
    };
  }, [props.options]);

  return (
    <div
      ref={container}
      role="img"
      aria-label={props.title}
      style={{ height: props.height ?? 260 }}
    />
  );
}
