import Highcharts from "highcharts";
import HighchartsReact from "highcharts-react-official";

export function CoversChart({ categories, data }: { categories: string[]; data: number[] }) {
  const options: Highcharts.Options = {
    title: { text: "Covers by day" },
    xAxis: { categories },
    yAxis: { title: { text: "Covers" } },
    series: [{ type: "column", name: "Covers", data, color: "#0d6efd" }],
    credits: { enabled: false },
    chart: { height: 320 },
  };
  return <HighchartsReact highcharts={Highcharts} options={options} />;
}
