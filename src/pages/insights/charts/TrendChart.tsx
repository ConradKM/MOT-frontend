import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'

/**
 * The only module in the app that imports Recharts. It is loaded with
 * React.lazy from the Insights page (see TrendPanel), so the library never
 * lands in the main bundle or the public booking wizard - the same split as
 * the Stripe and Square checkouts (src/components/customer/payments).
 *
 * One series at a time (the panel switches metric), so nothing is told apart
 * by colour alone. Animation is off outright rather than only under
 * prefers-reduced-motion: the data doesn't benefit from it.
 */
export interface TrendChartPoint {
  label: string
  value: number
}

export default function TrendChart({
  points,
  valueLabel,
  formatValue,
}: {
  points: TrendChartPoint[]
  valueLabel: string
  formatValue: (value: number) => string
}) {
  return (
    <div className="h-64 w-full" aria-hidden="true">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={points}
          margin={{ top: 8, right: 8, bottom: 0, left: 0 }}
          // The chart is decorative (aria-hidden); the panel's table is the
          // accessible version, so the chart must not take keyboard focus.
          accessibilityLayer={false}
        >
          <CartesianGrid vertical={false} stroke="#e2e8f0" />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 11, fill: '#64748b' }}
            tickLine={false}
            axisLine={{ stroke: '#cbd5e1' }}
            interval="preserveStartEnd"
            minTickGap={16}
          />
          <YAxis
            tick={{ fontSize: 11, fill: '#64748b' }}
            tickLine={false}
            axisLine={false}
            width={56}
            allowDecimals={false}
            tickFormatter={formatValue}
          />
          <Tooltip
            cursor={{ fill: '#f1f5f9' }}
            formatter={(value) => [formatValue(Number(value)), valueLabel]}
          />
          <Bar dataKey="value" name={valueLabel} fill="#334155" radius={[3, 3, 0, 0]} isAnimationActive={false} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
