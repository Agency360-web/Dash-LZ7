import * as React from "react";
import { CalendarIcon } from "lucide-react";
import { format, startOfDay, endOfDay, subDays, startOfMonth, startOfYear } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { DateRange } from "react-day-picker";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export type Preset = "today" | "7d" | "month" | "year" | "custom";

export const presetToRange = (preset: Preset): DateRange => {
  const now = new Date();
  switch (preset) {
    case "today":
      return { from: startOfDay(now), to: endOfDay(now) };
    case "7d":
      return { from: startOfDay(subDays(now, 6)), to: endOfDay(now) };
    case "month":
      return { from: startOfMonth(now), to: endOfDay(now) };
    case "year":
      return { from: startOfYear(now), to: endOfDay(now) };
    default:
      return { from: startOfDay(subDays(now, 6)), to: endOfDay(now) };
  }
};

interface Props {
  preset: Preset;
  onPresetChange: (p: Preset) => void;
  range: DateRange | undefined;
  onRangeChange: (r: DateRange | undefined) => void;
}

export function DateRangePicker({ preset, onPresetChange, range, onRangeChange }: Props) {
  return (
    <div className="flex items-center gap-2">
      <Select value={preset} onValueChange={(v) => onPresetChange(v as Preset)}>
        <SelectTrigger className="w-[140px] bg-card">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="today">Hoje</SelectItem>
          <SelectItem value="7d">7 dias</SelectItem>
          <SelectItem value="month">Este mês</SelectItem>
          <SelectItem value="year">Este ano</SelectItem>
          <SelectItem value="custom">Personalizado</SelectItem>
        </SelectContent>
      </Select>
      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            className={cn(
              "w-[260px] justify-start text-left font-normal bg-card",
              !range && "text-muted-foreground"
            )}
          >
            <CalendarIcon className="mr-2 h-4 w-4" />
            {range?.from ? (
              range.to ? (
                <>
                  {format(range.from, "dd MMM yyyy", { locale: ptBR })} —{" "}
                  {format(range.to, "dd MMM yyyy", { locale: ptBR })}
                </>
              ) : (
                format(range.from, "dd MMM yyyy", { locale: ptBR })
              )
            ) : (
              <span>Selecione o período</span>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="end">
          <Calendar
            mode="range"
            selected={range}
            onSelect={(r) => {
              onRangeChange(r);
              onPresetChange("custom");
            }}
            numberOfMonths={2}
            initialFocus
            locale={ptBR}
            className={cn("p-3 pointer-events-auto")}
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}