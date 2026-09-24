import Highcharts from "highcharts";
import HighchartsReact from "highcharts-react-official";

export function NoShowChart({ noShows, completed }: { noShows: number; completed: number }) {
  const options: Highcharts.Options = {
    chart: { type: "pie", height: 260 },
    title: { text: "No-shows vs. completed" },
    credits: { enabled: false },
    series: [
      {
        type: "pie",
        name: "Reservations",
        data: [
          { name: "Completed / seated", y: completed, color: "#198754" },
          { name: "No-shows", y: noShows, color: "#dc3545" },
        ],
      },
    ],
  };
  return <HighchartsReact highcharts={Highcharts} options={options} />;
}
