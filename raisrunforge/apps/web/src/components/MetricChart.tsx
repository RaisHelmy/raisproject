import { useMemo } from "react";
import Highcharts from "highcharts";
import HighchartsReact from "highcharts-react-official";
import type { MetricSeries } from "@runforge/shared";

Highcharts.setOptions({
  chart: { backgroundColor: "transparent", style: { fontFamily: "inherit" } },
  title: { text: undefined },
  credits: { enabled: false },
  legend: { enabled: false },
  colors: ["#6366f1", "#38bdf8", "#f59e0b", "#22c55e", "#ef4444"],
  xAxis: {
    type: "datetime",
    lineColor: "#262b38",
    tickColor: "#262b38",
    labels: { style: { color: "#5a6178", fontSize: "10px" } },
  },
  yAxis: {
    gridLineColor: "#1d212c",
    labels: { style: { color: "#5a6178", fontSize: "10px" } },
    title: { text: undefined },
  },
  tooltip: {
    backgroundColor: "#171a23",
    borderColor: "#262b38",
    style: { color: "#e6e9f2", fontSize: "12px" },
  },
});

export function MetricChart({ series, height = 200, area = true }: { series: MetricSeries; height?: number; area?: boolean }) {
  const options: Highcharts.Options = useMemo(
    () => ({
      chart: { type: area ? "area" : "line", height },
      series: [
        {
          type: area ? "area" : "line",
          name: series.name,
          data: series.points.map((p) => [p.t, p.v]),
          fillOpacity: area ? 0.12 : 0,
          lineWidth: 1.75,
          marker: { enabled: false },
        },
      ],
      yAxis: { gridLineColor: "#1d212c", labels: { format: `{value} ${series.unit}`, style: { color: "#5a6178", fontSize: "10px" } } },
      plotOptions: {
        series: {
          animation: false,
          states: { hover: { lineWidth: 2 } },
        },
      },
      xAxis: {
        plotLines: (series.markers ?? []).map((m) => ({
          value: m.t,
          color: "#6366f1",
          width: 1,
          dashStyle: "Dash",
          label: { text: m.label, style: { color: "#a5b4fc", fontSize: "9px" }, rotation: 0, y: 12 },
        })),
      },
    }),
    [series, height, area],
  );

  return <HighchartsReact highcharts={Highcharts} options={options} />;
}
