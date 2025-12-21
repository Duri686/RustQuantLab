/**
 * FPS 帧率监控 Hook
 * 使用 requestAnimationFrame 测量浏览器实际渲染帧率
 */

import { useState, useEffect, useRef } from 'react';

export interface FpsStats {
  /** 当前帧率 */
  fps: number;
  /** 平均帧率 */
  avgFps: number;
  /** 最低帧率 */
  minFps: number;
  /** 最高帧率 */
  maxFps: number;
  /** 帧时间 (ms) */
  frameTime: number;
}

/**
 * 帧率监控 Hook
 * @param sampleSize - 采样数量，用于计算平均值，默认 60
 * @returns FpsStats 帧率统计数据
 */
export function useFpsMonitor(sampleSize: number = 60): FpsStats {
  const [stats, setStats] = useState<FpsStats>({
    fps: 0,
    avgFps: 0,
    minFps: 999,
    maxFps: 0,
    frameTime: 0,
  });

  const frameTimesRef = useRef<number[]>([]);
  const lastTimeRef = useRef<number>(performance.now());
  const rafIdRef = useRef<number>(0);

  useEffect(() => {
    let frameCount = 0;
    let lastFpsUpdate = performance.now();

    const measureFrame = (currentTime: number) => {
      const deltaTime = currentTime - lastTimeRef.current;
      lastTimeRef.current = currentTime;

      // 记录帧时间
      frameTimesRef.current.push(deltaTime);
      if (frameTimesRef.current.length > sampleSize) {
        frameTimesRef.current.shift();
      }

      frameCount++;

      // 每 500ms 更新一次显示
      if (currentTime - lastFpsUpdate >= 500) {
        const currentFps = Math.round(
          (frameCount * 1000) / (currentTime - lastFpsUpdate),
        );
        frameCount = 0;
        lastFpsUpdate = currentTime;

        // 计算统计数据
        const frameTimes = frameTimesRef.current;
        const avgFrameTime =
          frameTimes.reduce((a, b) => a + b, 0) / frameTimes.length;
        const avgFps = Math.round(1000 / avgFrameTime);
        const minFrameTime = Math.min(...frameTimes);
        const maxFrameTime = Math.max(...frameTimes);

        setStats({
          fps: currentFps,
          avgFps,
          minFps: Math.round(1000 / maxFrameTime), // 最长帧时间 = 最低帧率
          maxFps: Math.round(1000 / minFrameTime), // 最短帧时间 = 最高帧率
          frameTime: Math.round(avgFrameTime * 10) / 10,
        });
      }

      rafIdRef.current = requestAnimationFrame(measureFrame);
    };

    rafIdRef.current = requestAnimationFrame(measureFrame);

    return () => {
      if (rafIdRef.current) {
        cancelAnimationFrame(rafIdRef.current);
      }
    };
  }, [sampleSize]);

  return stats;
}
