import React from "react";
import { SANS } from "../fonts";

/** Small handle watermark, bottom-right. */
export const Watermark: React.FC<{ handle: string }> = ({ handle }) => (
  <div
    style={{
      position: "absolute",
      right: 44,
      bottom: 64,
      fontFamily: SANS,
      fontWeight: 700,
      fontSize: 30,
      letterSpacing: "0.02em",
      color: "rgba(255,255,255,0.62)",
      textShadow: "0 2px 8px rgba(0,0,0,0.5)",
    }}
  >
    {handle}
  </div>
);
