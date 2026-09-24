import type { Options, YAxisOptions } from "highcharts";

/**
 * One chart theme for the whole app, so charts read as a single system and
 * inherit the Bootstrap palette rather than Highcharts' defaults.
 */
export const SERIES_COLORS = ["#7c5cff", "#4dabf7", "#2fb344", "#f6c343", "#f0693b", "#adb5bd"];

export function baseChartOptions(dark: boolean): Options {
  const text = dark ? "#dee2e6" : "#212529";
  const muted = dark ? "#868e96" : "#6c757d";
  const grid = dark ? "rgba(255,255,255,.08)" : "rgba(0,0,0,.08)";

  return {
    chart: { backgroundColor: "transparent", style: { fontFamily: "inherit" }, spacing: [8, 8, 8, 8] },
    colors: SERIES_COLORS,
    title: { text: undefined },
    credits: { enabled: false },
    legend: { itemStyle: { color: text }, itemHoverStyle: { color: text } },
    xAxis: { labels: { style: { color: muted } }, lineColor: grid, tickColor: grid },
    yAxis: { title: { text: undefined }, labels: { style: { color: muted } }, gridLineColor: grid },
    tooltip: { backgroundColor: dark ? "#212529" : "#fff", style: { color: text }, borderWidth: 0, shadow: true },
    accessibility: { enabled: false },
    plotOptions: { series: { animation: false } },
  };
}

/** A y-axis labelled in ringgit, built from the shared theme. */
export function ringgitAxis(base: Options): YAxisOptions {
  const axis = (Array.isArray(base.yAxis) ? base.yAxis[0] : base.yAxis) ?? {};
  return { ...axis, labels: { ...axis.labels, format: "RM{value}" } };
}
