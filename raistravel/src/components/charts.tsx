import Highcharts from 'highcharts'
import { HighchartsReact } from 'highcharts-react-official'
import { rm } from '../utils/format'

Highcharts.setOptions({
  chart: {
    style: { fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif" },
    backgroundColor: 'transparent',
  },
  colors: ['#0e7c66', '#ff6b4a', '#f2b134', '#4a7ba6', '#8e7cc3', '#5c6f6b'],
  credits: { enabled: false },
  title: { text: undefined },
})

export function BudgetDonut({ data }: { data: { name: string; y: number }[] }) {
  const options: Highcharts.Options = {
    chart: { type: 'pie', height: 280 },
    tooltip: { pointFormatter() { return `<b>${rm(this.y ?? 0)}</b> (${Math.round(this.percentage ?? 0)}%)` } },
    plotOptions: {
      pie: {
        innerSize: '65%',
        borderRadius: 6,
        dataLabels: {
          enabled: true,
          format: '{point.name} {point.percentage:.0f}%',
          style: { fontWeight: '600', fontSize: '0.78rem', color: '#16302b', textOutline: 'none' },
        },
      },
    },
    series: [{ type: 'pie', name: 'Budget', data }],
    accessibility: { enabled: false },
  }
  return <HighchartsReact highcharts={Highcharts} options={options} />
}

export function DailySpendChart({ days, values }: { days: string[]; values: number[] }) {
  const options: Highcharts.Options = {
    chart: { type: 'column', height: 260 },
    xAxis: { categories: days, lineColor: '#e8ece9', labels: { style: { color: '#5c6f6b' } } },
    yAxis: {
      title: { text: undefined },
      gridLineColor: '#eef1ef',
      labels: { formatter() { return rm(Number(this.value)) }, style: { color: '#5c6f6b' } },
    },
    legend: { enabled: false },
    tooltip: { pointFormatter() { return `<b>${rm(this.y ?? 0)}</b> group spend` } },
    plotOptions: { column: { borderRadius: 6, color: '#0e7c66' } },
    series: [{ type: 'column', name: 'Daily spend', data: values }],
    accessibility: { enabled: false },
  }
  return <HighchartsReact highcharts={Highcharts} options={options} />
}

export function CompareBars({
  categories, series,
}: {
  categories: string[]
  series: { name: string; data: number[]; color?: string }[]
}) {
  const options: Highcharts.Options = {
    chart: { type: 'bar', height: 90 + categories.length * 62 },
    xAxis: { categories, lineColor: '#e8ece9', labels: { style: { fontWeight: '600', color: '#16302b' } } },
    yAxis: {
      title: { text: undefined }, gridLineColor: '#eef1ef',
      labels: { formatter() { return rm(Number(this.value)) }, style: { color: '#5c6f6b' } },
    },
    tooltip: { pointFormatter() { return `${this.series.name}: <b>${rm(this.y ?? 0)}</b>` } },
    plotOptions: { bar: { borderRadius: 5, groupPadding: 0.12 } },
    series: series.map((s) => ({ type: 'bar' as const, name: s.name, data: s.data, color: s.color })),
    accessibility: { enabled: false },
  }
  return <HighchartsReact highcharts={Highcharts} options={options} />
}
