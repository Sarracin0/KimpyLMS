'use client'

import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  TooltipProps,
  XAxis,
  YAxis,
} from 'recharts'

type TrendPoint = {
  label: string
  completions: number
  aiInteractions: number
}

type Props = {
  data: TrendPoint[]
}

type TooltipPayload = TooltipProps<number, string>['payload']

const metricName: Record<keyof TrendPoint, string> = {
  label: 'label',
  completions: 'Completions',
  aiInteractions: 'Coach conversations',
}

const formatValue = (value: number) =>
  new Intl.NumberFormat('it-IT', { maximumFractionDigits: 0 }).format(value)

const TrendTooltip = ({ active, payload, label }: TooltipProps<number, string>) => {
  if (!active || !payload || payload.length === 0) return null

  const parsed = payload as TooltipPayload
  return (
    <div className="rounded-xl border border-border/50 bg-white/90 px-3 py-2 text-xs text-foreground shadow-md backdrop-blur">
      <p className="font-medium">{label}</p>
      <div className="mt-1 space-y-1">
        {parsed.map((entry) => (
          <div key={entry.dataKey} className="flex items-center justify-between gap-4">
            <span className="text-muted-foreground">
              {metricName[entry.dataKey as keyof TrendPoint]}
            </span>
            <span className="font-semibold text-foreground">{formatValue(Number(entry.value ?? 0))}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

export function EngagementTrendChart({ data }: Props) {
  if (data.length === 0) {
    return (
      <div className="flex h-56 items-center justify-center text-sm text-muted-foreground">
        Ancora nessun dato storico.
      </div>
    )
  }

  return (
    <div className="h-56 w-full">
      <ResponsiveContainer>
        <LineChart data={data} margin={{ top: 12, bottom: 12, left: -20, right: 12 }}>
          <CartesianGrid stroke="rgba(148, 163, 184, 0.25)" strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fill: '#64748b', fontSize: 12 }} interval="preserveEnd" />
          <YAxis hide domain={[0, 'auto']} />
          <Tooltip content={<TrendTooltip />} cursor={{ stroke: 'rgba(148, 163, 184, 0.35)' }} />
          <Line
            type="monotone"
            dataKey="completions"
            stroke="rgb(15, 118, 110)"
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4, strokeWidth: 0 }}
          />
          <Line
            type="monotone"
            dataKey="aiInteractions"
            stroke="rgb(59, 130, 246)"
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4, strokeWidth: 0 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
