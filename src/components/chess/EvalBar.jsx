import React from 'react';

export default function EvalBar({ evalScore = 0 }) {
  // clamp between -10 and +10
  const clamped = Math.max(-10, Math.min(10, evalScore));

  const whitePercent = 50 + (clamped * 5);

  return (
    <div className="w-3 h-64 bg-gray-300 rounded-full relative overflow-hidden">
      
      {/* white advantage */}
      <div
        className="absolute bottom-0 w-full bg-white transition-all"
        style={{ height: `${whitePercent}%` }}
      />

      {/* center line */}
      <div className="absolute top-1/2 w-full h-[2px] bg-black/30" />
    </div>
  );
}
