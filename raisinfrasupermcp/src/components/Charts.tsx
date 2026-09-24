import Highcharts from "highcharts";
import HighchartsReact from "highcharts-react-official";

Highcharts.setOptions({ chart: { style: { fontFamily: "inherit" }, backgroundColor: "transparent", spacing: [8, 8, 8, 8] }, colors: ["#2563eb", "#16a34a", "#d97706", "#7c3aed", "#0891b2", "#dc2626"], title: { text: undefined }, credits: { enabled: false }, legend: { itemStyle: { fontSize: "11px", fontWeight: "500", color: "#4b5563" } }, xAxis: { lineColor: "#e3e6ea", tickColor: "#e3e6ea", labels: { style: { fontSize: "11px", color: "#6b7280" } } }, yAxis: { gridLineColor: "#eef0f3", title: { text: undefined }, labels: { style: { fontSize: "11px", color: "#6b7280" } } }, tooltip: { shared: true, borderColor: "#e3e6ea", style: { fontSize: "12px" } }, plotOptions: { series: { animation: false, marker: { enabled: false } }, column: { borderRadius: 2, borderWidth: 0 }, area: { fillOpacity: .12, lineWidth: 2 } } });

export function Chart({ options, height = 220 }: { options: Highcharts.Options; height?: number }) {
  return <HighchartsReact highcharts={Highcharts} options={{ ...options, chart: { ...(options.chart ?? {}), height } }} />;
}
export { Highcharts };
