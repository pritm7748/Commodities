'use client';

import { useEffect, useRef } from 'react';

interface SparklineProps {
    data: number[];
    width?: number;
    height?: number;
    color?: string;
    fillColor?: string;
    lineWidth?: number;
}

export default function Sparkline({
    data,
    width = 80,
    height = 24,
    color,
    fillColor,
    lineWidth = 1.5,
}: SparklineProps) {
    const canvasRef = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas || data.length < 2) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const dpr = window.devicePixelRatio || 1;
        canvas.width = width * dpr;
        canvas.height = height * dpr;
        ctx.scale(dpr, dpr);
        ctx.clearRect(0, 0, width, height);

        const isPositive = data[data.length - 1] >= data[0];
        const lineColor = color || (isPositive ? '#22c55e' : '#ef4444');
        const fill = fillColor || (isPositive ? 'rgba(34, 197, 94, 0.12)' : 'rgba(239, 68, 68, 0.12)');

        const min = Math.min(...data);
        const max = Math.max(...data);
        const range = max - min || 1;
        const padding = 2;

        const xStep = (width - padding * 2) / (data.length - 1);
        const yScale = (height - padding * 2) / range;

        // Create line path
        ctx.beginPath();
        data.forEach((val, i) => {
            const x = padding + i * xStep;
            const y = height - padding - (val - min) * yScale;
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        });

        // Fill
        ctx.save();
        const lastX = padding + (data.length - 1) * xStep;
        ctx.lineTo(lastX, height);
        ctx.lineTo(padding, height);
        ctx.closePath();
        ctx.fillStyle = fill;
        ctx.fill();
        ctx.restore();

        // Stroke
        ctx.beginPath();
        data.forEach((val, i) => {
            const x = padding + i * xStep;
            const y = height - padding - (val - min) * yScale;
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        });
        ctx.strokeStyle = lineColor;
        ctx.lineWidth = lineWidth;
        ctx.stroke();
    }, [data, width, height, color, fillColor, lineWidth]);

    return (
        <canvas
            ref={canvasRef}
            style={{ width, height, display: 'block' }}
        />
    );
}
