import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@lets_work/ui/components/card";
import {
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@lets_work/ui/components/chart";
import { TrendingUp } from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  XAxis,
  YAxis,
} from "recharts";

const paymentTrend = [
  { month: "Jan", volume: 118 },
  { month: "Feb", volume: 132 },
  { month: "Mar", volume: 128 },
  { month: "Apr", volume: 145 },
  { month: "May", volume: 158 },
  { month: "Jun", volume: 172 },
  { month: "Jul", volume: 168 },
  { month: "Aug", volume: 185 },
  { month: "Sep", volume: 192 },
  { month: "Oct", volume: 201 },
  { month: "Nov", volume: 214 },
  { month: "Dec", volume: 228 },
];

const clientGrowth = [
  { quarter: "Q1", clients: 98 },
  { quarter: "Q2", clients: 112 },
  { quarter: "Q3", clients: 125 },
  { quarter: "Q4", clients: 138 },
];

const freelancerTrend = [
  { year: "20", count: 6.2 },
  { year: "21", count: 7.4 },
  { year: "22", count: 8.9 },
  { year: "23", count: 10.5 },
  { year: "24", count: 12.1 },
];

const paymentConfig = {
  volume: { label: "Volume", color: "var(--chart-1)" },
} satisfies ChartConfig;

const clientsConfig = {
  clients: { label: "Clients", color: "var(--chart-1)" },
} satisfies ChartConfig;

const freelancersConfig = {
  count: { label: "Freelancers", color: "var(--chart-1)" },
} satisfies ChartConfig;

export default function LandingStatsBento() {
  return (
    <section className="border-y border-border bg-muted/40 py-16">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-10 px-6">
        <div className="flex flex-col gap-2">
          <h2 className="text-2xl font-semibold tracking-tight md:text-3xl">
            Platform at a glance
          </h2>
          <p className="text-muted-foreground">
            Real momentum across payments, clients, and talent worldwide.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-6 md:grid-rows-2">
          <Card className="md:col-span-4 md:row-span-2">
            <CardHeader>
              <CardDescription>Paid to freelancers</CardDescription>
              <div className="flex items-end justify-between gap-4">
                <CardTitle className="text-3xl font-semibold tabular-nums md:text-4xl">
                  $2B+
                </CardTitle>
                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                  <TrendingUp className="size-3.5 text-primary" />
                  +18% YoY
                </span>
              </div>
            </CardHeader>
            <CardContent className="pb-4">
              <ChartContainer
                config={paymentConfig}
                className="aspect-auto h-[200px] w-full"
              >
                <AreaChart
                  data={paymentTrend}
                  margin={{ left: 0, right: 0, top: 4, bottom: 0 }}
                >
                  <defs>
                    <linearGradient
                      id="paymentFill"
                      x1="0"
                      y1="0"
                      x2="0"
                      y2="1"
                    >
                      <stop
                        offset="0%"
                        stopColor="var(--color-volume)"
                        stopOpacity={0.35}
                      />
                      <stop
                        offset="100%"
                        stopColor="var(--color-volume)"
                        stopOpacity={0.02}
                      />
                    </linearGradient>
                  </defs>
                  <CartesianGrid vertical={false} strokeDasharray="3 3" />
                  <XAxis
                    dataKey="month"
                    tickLine={false}
                    axisLine={false}
                    tickMargin={8}
                    interval="preserveStartEnd"
                  />
                  <ChartTooltip
                    content={<ChartTooltipContent indicator="line" />}
                  />
                  <Area
                    type="monotone"
                    dataKey="volume"
                    stroke="var(--color-volume)"
                    fill="url(#paymentFill)"
                    strokeWidth={2}
                  />
                </AreaChart>
              </ChartContainer>
            </CardContent>
          </Card>

          <Card className="md:col-span-2">
            <CardHeader>
              <CardDescription>Active clients</CardDescription>
              <CardTitle className="text-2xl font-semibold tabular-nums md:text-3xl">
                500K+
              </CardTitle>
            </CardHeader>
            <CardContent className="pb-4">
              <ChartContainer
                config={clientsConfig}
                className="aspect-auto h-[120px] w-full"
              >
                <BarChart
                  data={clientGrowth}
                  margin={{ left: 0, right: 0, top: 4, bottom: 0 }}
                >
                  <CartesianGrid vertical={false} strokeDasharray="3 3" />
                  <XAxis
                    dataKey="quarter"
                    tickLine={false}
                    axisLine={false}
                    tickMargin={8}
                  />
                  <ChartTooltip content={<ChartTooltipContent hideLabel />} />
                  <Bar
                    dataKey="clients"
                    fill="var(--color-clients)"
                    radius={[4, 4, 0, 0]}
                    maxBarSize={32}
                  />
                </BarChart>
              </ChartContainer>
            </CardContent>
          </Card>

          <Card className="md:col-span-2">
            <CardHeader>
              <CardDescription>Freelancers on platform</CardDescription>
              <CardTitle className="text-2xl font-semibold tabular-nums md:text-3xl">
                12M+
              </CardTitle>
            </CardHeader>
            <CardContent className="pb-4">
              <ChartContainer
                config={freelancersConfig}
                className="aspect-auto h-[120px] w-full"
              >
                <LineChart
                  data={freelancerTrend}
                  margin={{ left: 0, right: 8, top: 4, bottom: 0 }}
                >
                  <CartesianGrid vertical={false} strokeDasharray="3 3" />
                  <XAxis
                    dataKey="year"
                    tickLine={false}
                    axisLine={false}
                    tickMargin={8}
                  />
                  <YAxis hide domain={["dataMin - 1", "dataMax + 1"]} />
                  <ChartTooltip content={<ChartTooltipContent hideLabel />} />
                  <Line
                    type="monotone"
                    dataKey="count"
                    stroke="var(--color-count)"
                    strokeWidth={2}
                    dot={false}
                  />
                </LineChart>
              </ChartContainer>
            </CardContent>
          </Card>
        </div>
      </div>
    </section>
  );
}
