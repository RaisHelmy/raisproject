import Highcharts from "highcharts";
import HighchartsReact from "highcharts-react-official";
import { useMemo } from "react";
import { usePrefs } from "@/services/prefs";

/** Highcharts wrapper themed to the paper/ink palette. */
export function Chart({ type, categories, series, height = 260, valueSuffix, stacked }: { type: "line" | "column" | "area" | "pie" | "bar"; categories?: string[]; series: { name: string; data: number[] | { name: string; y: number }[]; color?: string }[]; height?: number; valueSuffix?: string; stacked?: boolean }) {
  const { resolvedTheme } = usePrefs();
  const options = useMemo<Highcharts.Options>(() => {
    const ink = resolvedTheme === "dark" ? "#b3ac9f" : "#5c554b"; const line = resolvedTheme === "dark" ? "#2f2e35" : "#e4dccb";
    const palette = ["#a8322d", "#3f7f6b", "#b8913f", "#4b6a8f", "#8a5a9e", "#c97b4a", "#5c554b"];
    return {
      chart: { type, height, backgroundColor: "transparent", style: { fontFamily: "Inter, system-ui, sans-serif" }, spacing: [8, 8, 8, 8] },
      title: { text: undefined }, credits: { enabled: false }, colors: palette,
      xAxis: { categories, lineColor: line, tickColor: line, labels: { style: { color: ink, fontSize: "11px" } } },
      yAxis: { title: { text: undefined }, gridLineColor: line, labels: { style: { color: ink, fontSize: "11px" } } },
      legend: { enabled: series.length > 1 || type === "pie", itemStyle: { color: ink, fontWeight: "500", fontSize: "12px" } },
      tooltip: { valueSuffix, shared: type !== "pie", backgroundColor: resolvedTheme === "dark" ? "#1f1e23" : "#fbf8f2", borderColor: line, style: { color: resolvedTheme === "dark" ? "#ece7dc" : "#24211d" } },
      plotOptions: { series: { marker: { enabled: false }, animation: { duration: 300 }, stacking: stacked ? "normal" : undefined, borderRadius: 3 }, area: { fillOpacity: 0.12 }, pie: { innerSize: "62%", dataLabels: { enabled: false }, showInLegend: true, borderColor: "transparent" } },
      series: series.map((s) => ({ ...s, type })) as Highcharts.SeriesOptionsType[],
    };
  }, [type, categories, series, height, valueSuffix, stacked, resolvedTheme]);
  return <HighchartsReact highcharts={Highcharts} options={options} />;
}
