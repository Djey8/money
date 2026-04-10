import { Injectable } from '@angular/core';
import * as d3 from 'd3';

export interface ChartMargin {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export interface ChartDimensions {
  width: number;
  height: number;
  margin: ChartMargin;
}

export interface ChartSetup {
  svg: d3.Selection<SVGGElement, unknown, HTMLElement, any>;
  width: number;
  height: number;
  margin: ChartMargin;
}

export interface TrendLineConfig {
  svg: d3.Selection<SVGGElement, unknown, HTMLElement, any>;
  data: { date: Date; value: number }[];
  xScale: d3.ScaleTime<number, number>;
  yScale: d3.ScaleLinear<number, number>;
  color?: string;
  strokeWidth?: number;
  dashArray?: string;
  curve?: d3.CurveFactory;
}

export interface TooltipConfig {
  container: string;
  x: number;
  y: number;
  margin: ChartMargin;
  html: string;
  borderColor?: string;
  minWidth?: string;
}

export interface InfoBoxConfig extends TooltipConfig {
  id: string;
}

@Injectable({
  providedIn: 'root'
})
/**
 * Shared D3.js chart utilities: SVG setup, quadratic regression,
 * trend lines, tooltips, and info-box overlays.
 */
export class D3VisualizationService {

  /**
   * Clears the chart container and creates a new SVG with the given margins.
   * Returns the inner <g> element (already translated by margins), plus computed dimensions.
   */
  clearAndCreateSvg(
    containerSelector: string,
    margin: ChartMargin,
    heightOffset: number = 110
  ): ChartSetup {
    d3.select(containerSelector).selectAll("*").remove();

    const container = document.querySelector(containerSelector) as HTMLElement;
    const width = container
      ? container.clientWidth - margin.left - margin.right
      : window.innerWidth - margin.left - margin.right - 20;
    const height = window.innerHeight - margin.top - margin.bottom - heightOffset;

    const svg = d3.select(containerSelector)
      .append("svg")
      .attr("width", width + margin.left + margin.right)
      .attr("height", height + margin.top + margin.bottom)
      .append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`) as
      d3.Selection<SVGGElement, unknown, HTMLElement, any>;

    return { svg, width, height, margin };
  }

  /**
   * Quadratic regression via least-squares (Cramer's rule).
   * Fits y = ax² + bx + c over normalized [0,1] x-range.
   * Returns 51 interpolated points for smooth curve rendering.
   */
  quadraticRegression(data: { date: Date; value: number }[]): { date: Date; value: number }[] {
    const n = data.length;
    if (n < 3) return [];

    const minTime = data[0].date.getTime();
    const maxTime = data[n - 1].date.getTime();
    const timeRange = maxTime - minTime;

    const points = data.map(d => ({
      x: (d.date.getTime() - minTime) / timeRange,
      y: d.value
    }));

    let sumX = 0, sumX2 = 0, sumX3 = 0, sumX4 = 0;
    let sumY = 0, sumXY = 0, sumX2Y = 0;

    points.forEach(p => {
      const x = p.x, x2 = x * x, x3 = x2 * x, x4 = x3 * x;
      const y = p.y;

      sumX += x;
      sumX2 += x2;
      sumX3 += x3;
      sumX4 += x4;
      sumY += y;
      sumXY += x * y;
      sumX2Y += x2 * y;
    });

    const A = [
      [n, sumX, sumX2],
      [sumX, sumX2, sumX3],
      [sumX2, sumX3, sumX4]
    ];
    const b = [sumY, sumXY, sumX2Y];

    const det = A[0][0] * (A[1][1] * A[2][2] - A[1][2] * A[2][1]) -
                A[0][1] * (A[1][0] * A[2][2] - A[1][2] * A[2][0]) +
                A[0][2] * (A[1][0] * A[2][1] - A[1][1] * A[2][0]);

    if (Math.abs(det) < 1e-10) return [];

    const c = (b[0] * (A[1][1] * A[2][2] - A[1][2] * A[2][1]) -
              b[1] * (A[0][1] * A[2][2] - A[0][2] * A[2][1]) +
              b[2] * (A[0][1] * A[1][2] - A[0][2] * A[1][1])) / det;

    const bCoeff = (A[0][0] * (b[1] * A[2][2] - b[2] * A[1][2]) -
                    A[0][1] * (b[0] * A[2][2] - b[2] * A[2][0]) +
                    A[0][2] * (b[0] * A[1][2] - b[1] * A[2][0])) / det;

    const a = (A[0][0] * (A[1][1] * b[2] - A[1][2] * b[1]) -
              A[0][1] * (A[1][0] * b[2] - A[1][2] * b[0]) +
              A[0][2] * (A[1][0] * b[1] - A[1][1] * b[0])) / det;

    const result: { date: Date; value: number }[] = [];
    const steps = 50;
    for (let i = 0; i <= steps; i++) {
      const x = i / steps;
      const y = a * x * x + bCoeff * x + c;
      const time = minTime + x * timeRange;
      result.push({ date: new Date(time), value: y });
    }

    return result;
  }

  /**
   * Draws a quadratic trend line on an SVG chart.
   */
  drawTrendLine(config: TrendLineConfig): void {
    const {
      svg, data, xScale, yScale,
      color = 'orange',
      strokeWidth = 3,
      dashArray = '5 3',
      curve = d3.curveMonotoneX
    } = config;

    const trend = this.quadraticRegression(data);
    if (trend.length === 0) return;

    svg.append("path")
      .datum(trend)
      .attr("fill", "none")
      .attr("stroke", color)
      .attr("stroke-dasharray", dashArray)
      .attr("stroke-width", strokeWidth)
      .attr("d", d3.line<{ date: Date; value: number }>()
        .x(d => xScale(d.date))
        .y(d => yScale(d.value))
        .curve(curve)
      );
  }

  /**
   * Creates a hover tooltip positioned near a data point.
   */
  showTooltip(config: TooltipConfig): void {
    const {
      container, x, y, margin, html,
      borderColor = '#3f51b5',
      minWidth = '150px'
    } = config;

    const dotX = x + margin.left;
    const side = dotX < window.innerWidth / 2 ? 'right' : 'left';
    const left = side === 'right' ? dotX + 12 : dotX - 200;
    const top = y + margin.top - 10;

    d3.select(container)
      .append("div")
      .attr("class", "dot-tooltip")
      .style("position", "absolute")
      .style("left", `${left}px`)
      .style("top", `${top}px`)
      .style("background", "var(--color-surface)")
      .style("border", `1px solid ${borderColor}`)
      .style("padding", "12px 16px")
      .style("border-radius", "6px")
      .style("font-size", "14px")
      .style("box-shadow", "0 2px 8px rgba(0,0,0,0.15)")
      .style("pointer-events", "none")
      .style("min-width", minWidth)
      .html(html);
  }

  /**
   * Creates a persistent info box (click-expandable) positioned near a data point.
   */
  showInfoBox(config: InfoBoxConfig): void {
    const {
      id, container, x, y, margin, html,
      borderColor = '#3f51b5'
    } = config;

    d3.select(`#${id}`).remove();
    d3.selectAll(".dot-tooltip").remove();

    const dotX = x + margin.left;
    const side = dotX < window.innerWidth / 2 ? 'right' : 'left';
    const left = side === 'right' ? dotX + 12 : dotX - 200;
    const top = y + margin.top - 10;

    d3.select(container)
      .append("div")
      .attr("id", id)
      .style("position", "absolute")
      .style("left", `${left}px`)
      .style("top", `${top}px`)
      .style("background", "var(--color-surface)")
      .style("border", `1px solid ${borderColor}`)
      .style("padding", "12px 16px")
      .style("border-radius", "6px")
      .style("font-size", "14px")
      .style("box-shadow", "0 4px 12px rgba(0,0,0,0.2)")
      .style("max-height", "400px")
      .style("overflow", "auto")
      .style("z-index", "100")
      .html(html);
  }

  /**
   * Removes all tooltips.
   */
  removeTooltips(): void {
    d3.selectAll(".dot-tooltip").remove();
  }

  /**
   * Registers a body-click handler (namespaced) that removes an info box when clicking outside.
   */
  registerBodyDismiss(namespace: string, infoBoxId: string): void {
    d3.select("body").on(`click.${namespace}`, function () {
      d3.select(`#${infoBoxId}`).remove();
    });
  }

  /**
   * Unregisters a body-click handler by namespace.
   */
  unregisterBodyDismiss(namespace: string): void {
    d3.select("body").on(`click.${namespace}`, null);
  }
}
