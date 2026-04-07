import { useId } from "react";

function useSvgId(base: string) {
  const id = useId();
  return (name: string) => `${base}-${name}-${id.replace(/:/g, "")}`;
}

type P = [number, number];
function pts(p: P[]): string { return p.map(c => `${c[0]},${c[1]}`).join(" "); }
function lerp(a: P, b: P, t: number): P { return [a[0]+(b[0]-a[0])*t, a[1]+(b[1]-a[1])*t]; }

function isoBox(cx: number, cy: number, w: number, d: number, h: number) {
  const bS: P = [cx, cy];
  const bE: P = [cx + w, cy - w * 0.5];
  const bN: P = [cx + w - d, cy - w * 0.5 - d * 0.5];
  const bW: P = [cx - d, cy - d * 0.5];
  const tS: P = [cx, cy - h];
  const tE: P = [cx + w, cy - w * 0.5 - h];
  const tN: P = [cx + w - d, cy - w * 0.5 - d * 0.5 - h];
  const tW: P = [cx - d, cy - d * 0.5 - h];
  return { leftFace: pts([bS, bW, tW, tS]), rightFace: pts([bS, bE, tE, tS]), topFace: pts([tS, tE, tN, tW]), bS, bE, bN, bW, tS, tE, tN, tW };
}

function peakedRoof(tS: P, tE: P, tN: P, tW: P, rh: number) {
  const ridgeSW: P = [(tW[0]+tS[0])/2, (tW[1]+tS[1])/2 - rh];
  const ridgeNE: P = [(tE[0]+tN[0])/2, (tE[1]+tN[1])/2 - rh];
  return {
    frontSlope: pts([tS, tE, ridgeNE, ridgeSW]),
    leftGable: pts([tW, tS, ridgeSW]),
    rightGable: pts([tE, tN, ridgeNE]),
    ridgeSW, ridgeNE,
  };
}

function Shadow({ cx, cy, rx, ry }: { cx: number; cy: number; rx: number; ry: number }) {
  return <ellipse cx={cx} cy={cy} rx={rx} ry={ry} fill="rgba(0,0,0,0.18)"/>;
}

function WheatFieldSVG({ level }: { level: number }) {
  const box = isoBox(100, 142, 55, 55, 8);
  const rowCount = level === 1 ? 5 : level === 2 ? 7 : 9;
  const wheatColor = level === 3 ? "#DAA520" : level === 2 ? "#C8A030" : "#B89830";
  const soilTop = level === 3 ? "#8B6914" : "#7A5B10";
  return (
    <g>
      <Shadow cx={100} cy={144} rx={52} ry={14}/>
      <polygon points={box.rightFace} fill="#5A3E0A"/>
      <polygon points={box.leftFace} fill="#4A3008"/>
      <polygon points={box.topFace} fill={soilTop}/>
      {Array.from({ length: rowCount }).map((_, i) => {
        const t = (i + 1) / (rowCount + 1);
        const a = lerp(box.tW, box.tN, t);
        const b = lerp(box.tS, box.tE, t);
        return <line key={i} x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} stroke={wheatColor} strokeWidth={level === 3 ? 4 : 3} strokeLinecap="round" opacity={0.85}/>;
      })}
      {level >= 2 && Array.from({ length: 4 }).map((_, i) => {
        const t = (i + 1) / 5;
        const c = lerp(box.tS, box.tN, t);
        return <circle key={`g-${i}`} cx={c[0]} cy={c[1]} r={2.5} fill="#DAA520" opacity={0.5}/>;
      })}
      {level === 3 && (
        <>
          <polygon points={pts([lerp(box.tW, box.tS, 0.5), lerp(box.tS, box.tE, 0.5), lerp(box.tE, box.tN, 0.5), lerp(box.tN, box.tW, 0.5)])} fill="rgba(255,215,0,0.08)"/>
          <polygon points={box.topFace} fill="none" stroke="#DAA520" strokeWidth="1.5" opacity="0.4"/>
        </>
      )}
      <polygon points={pts([box.bW, box.bN, box.tN, box.tW])} fill="rgba(0,0,0,0.04)"/>
    </g>
  );
}

function VegetablePatchSVG({ level }: { level: number }) {
  const box = isoBox(100, 142, 55, 55, 8);
  const rowCount = level === 1 ? 4 : level === 2 ? 6 : 8;
  const colors = ["#E65100", "#2E7D32", "#7B1FA2", "#1565C0", "#F57F17", "#D84315", "#388E3C", "#6A1B9A"];
  return (
    <g>
      <Shadow cx={100} cy={144} rx={52} ry={14}/>
      <polygon points={box.rightFace} fill="#3E2716"/>
      <polygon points={box.leftFace} fill="#2E1B0E"/>
      <polygon points={box.topFace} fill="#5D4037"/>
      {Array.from({ length: rowCount }).map((_, i) => {
        const t = (i + 1) / (rowCount + 1);
        const a = lerp(box.tW, box.tN, t);
        const b = lerp(box.tS, box.tE, t);
        return (
          <g key={i}>
            <line x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} stroke="#4E342E" strokeWidth={5} strokeLinecap="round" opacity={0.5}/>
            {[0.2, 0.4, 0.6, 0.8].map((s, j) => {
              const p = lerp(a, b, s);
              return <circle key={j} cx={p[0]} cy={p[1]} r={level === 3 ? 3.5 : 2.8} fill={colors[(i + j) % colors.length]} opacity={0.85}/>;
            })}
          </g>
        );
      })}
      {level === 3 && <polygon points={box.topFace} fill="none" stroke="#FFD700" strokeWidth="1.5" opacity="0.3"/>}
    </g>
  );
}

function AppleOrchardSVG({ level }: { level: number }) {
  const box = isoBox(100, 142, 55, 55, 6);
  const treeCount = level === 1 ? 3 : level === 2 ? 5 : 7;
  const positions: [number, number][] = [
    [0.3, 0.3], [0.6, 0.25], [0.4, 0.6], [0.7, 0.55], [0.5, 0.45],
    [0.25, 0.7], [0.75, 0.4],
  ];
  return (
    <g>
      <Shadow cx={100} cy={144} rx={52} ry={14}/>
      <polygon points={box.rightFace} fill="#2E7D32"/>
      <polygon points={box.leftFace} fill="#1B5E20"/>
      <polygon points={box.topFace} fill="#43A047"/>
      {positions.slice(0, treeCount).map((pos, i) => {
        const cx = box.tW[0] + (box.tE[0] - box.tW[0]) * pos[0] + (box.tN[0] - box.tW[0]) * pos[1];
        const cy = box.tW[1] + (box.tE[1] - box.tW[1]) * pos[0] + (box.tN[1] - box.tW[1]) * pos[1];
        return (
          <g key={i}>
            <ellipse cx={cx} cy={cy + 6} rx={4} ry={2} fill="rgba(0,0,0,0.15)"/>
            <rect x={cx - 1.5} y={cy - 2} width={3} height={8} rx={1} fill="#5D4037"/>
            <circle cx={cx} cy={cy - 5} r={7} fill="#2E7D32"/>
            <circle cx={cx - 2} cy={cy - 7} r={5} fill="#388E3C"/>
            <circle cx={cx + 2} cy={cy - 6} r={4.5} fill="#43A047"/>
            {level >= 2 && <>
              <circle cx={cx + 3} cy={cy - 3} r={2} fill="#F44336"/>
              <circle cx={cx - 2} cy={cy - 8} r={1.8} fill="#F44336"/>
            </>}
            {level === 3 && <circle cx={cx} cy={cy - 5} r={1.5} fill="#FFD700" opacity={0.6}/>}
          </g>
        );
      })}
    </g>
  );
}

function GreenhouseSVG({ level }: { level: number }) {
  const box = isoBox(100, 140, 50, 42, 30);
  const roof = peakedRoof(box.tS, box.tE, box.tN, box.tW, 14);
  const glassOp = level === 3 ? 0.35 : level === 2 ? 0.3 : 0.25;
  const frameColor = level === 3 ? "#B0BEC5" : "#90A4AE";
  return (
    <g>
      <Shadow cx={100} cy={142} rx={46} ry={12}/>
      <polygon points={box.rightFace} fill={`rgba(200,230,200,${glassOp})`} stroke={frameColor} strokeWidth="1.5"/>
      <polygon points={box.leftFace} fill={`rgba(180,220,180,${glassOp - 0.05})`} stroke={frameColor} strokeWidth="1.5"/>
      {[0.33, 0.66].map((t, i) => {
        const a = lerp(box.bS, box.bE, t);
        const b = lerp(box.tS, box.tE, t);
        return <line key={`r${i}`} x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} stroke={frameColor} strokeWidth="1" opacity="0.7"/>;
      })}
      {[0.33, 0.66].map((t, i) => {
        const a = lerp(box.bS, box.bW, t);
        const b = lerp(box.tS, box.tW, t);
        return <line key={`l${i}`} x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} stroke={frameColor} strokeWidth="1" opacity="0.7"/>;
      })}
      <line x1={lerp(box.bS, box.bE, 0.5)[0]} y1={lerp(box.bS, box.bE, 0.5)[1]} x2={lerp(box.tS, box.tE, 0.5)[0]} y2={lerp(box.tS, box.tE, 0.5)[1]} stroke={frameColor} strokeWidth="1.5"/>
      <polygon points={roof.frontSlope} fill={`rgba(220,240,220,${glassOp + 0.05})`} stroke={frameColor} strokeWidth="1.5"/>
      <polygon points={roof.leftGable} fill={`rgba(200,230,200,${glassOp})`} stroke={frameColor} strokeWidth="1.5"/>
      <polygon points={roof.rightGable} fill={`rgba(190,220,190,${glassOp - 0.05})`} stroke={frameColor} strokeWidth="1.5"/>
      <line x1={roof.ridgeSW[0]} y1={roof.ridgeSW[1]} x2={roof.ridgeNE[0]} y2={roof.ridgeNE[1]} stroke={frameColor} strokeWidth="2"/>
      {level >= 2 && [0.3, 0.5, 0.7].map((t, i) => {
        const p = lerp(box.tS, box.tN, t);
        return <circle key={i} cx={p[0]} cy={p[1] + 4} r={3} fill="#66BB6A" opacity={0.5}/>;
      })}
      {level === 3 && <polygon points={box.topFace} fill="rgba(76,175,80,0.1)"/>}
    </g>
  );
}

function ChickenCoopSVG({ level }: { level: number }) {
  const box = isoBox(100, 138, 42, 35, 28);
  const roof = peakedRoof(box.tS, box.tE, box.tN, box.tW, 12);
  const wallR = level === 3 ? "#FFCC80" : level === 2 ? "#DEB887" : "#C8A87A";
  const wallL = level === 3 ? "#D4A050" : level === 2 ? "#B8956A" : "#A88050";
  const roofC = level === 3 ? "#8D6E63" : "#795548";
  const fenceBox = isoBox(108, 148, 36, 28, 12);
  return (
    <g>
      <Shadow cx={105} cy={146} rx={50} ry={14}/>
      <polygon points={fenceBox.rightFace} fill="none" stroke="#8D6E63" strokeWidth="1.5" strokeDasharray="4 3"/>
      <polygon points={fenceBox.leftFace} fill="none" stroke="#6D4C41" strokeWidth="1.5" strokeDasharray="4 3"/>
      <polygon points={fenceBox.topFace} fill="rgba(139,105,20,0.08)"/>
      {level >= 2 && [0.3, 0.7].map((t, i) => {
        const p = lerp(fenceBox.tS, fenceBox.tE, t);
        return (
          <g key={i}>
            <ellipse cx={p[0]} cy={p[1] + 2} rx={4} ry={2.5} fill="#FFF8E1"/>
            <circle cx={p[0] + 2} cy={p[1] - 1} r={2.5} fill="#FFECB3"/>
            <polygon points={`${p[0]+4},${p[1]-2} ${p[0]+6},${p[1]-3} ${p[0]+4},${p[1]-3.5}`} fill="#E65100"/>
          </g>
        );
      })}
      <polygon points={box.rightFace} fill={wallR}/>
      <polygon points={box.leftFace} fill={wallL}/>
      {[0.3, 0.6].map((t, i) => {
        const a = lerp(box.bS, box.bE, t);
        const b = lerp(box.tS, box.tE, t);
        return <line key={i} x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} stroke="rgba(0,0,0,0.06)" strokeWidth="1"/>;
      })}
      <rect x={lerp(box.bS, box.bE, 0.4)[0] - 5} y={box.bS[1] - 14} width={10} height={13} rx={1.5} fill="#5D4037"/>
      <rect x={lerp(box.bS, box.bE, 0.4)[0] - 4} y={box.bS[1] - 13} width={8} height={6} rx={1} fill="#3E2723"/>
      <polygon points={roof.frontSlope} fill={roofC}/>
      <polygon points={roof.leftGable} fill="#6D4C41"/>
      <polygon points={roof.rightGable} fill="#8D6E63"/>
      <line x1={roof.ridgeSW[0]} y1={roof.ridgeSW[1]} x2={roof.ridgeNE[0]} y2={roof.ridgeNE[1]} stroke="#4E342E" strokeWidth="2"/>
      {level === 3 && <>
        <polygon points={roof.frontSlope} fill="rgba(255,215,0,0.08)"/>
        <circle cx={roof.ridgeSW[0]} cy={roof.ridgeSW[1] - 4} r={3} fill="#FFD700" opacity={0.6}/>
      </>}
    </g>
  );
}

function DairyCowsSVG({ level }: { level: number }) {
  const barnBox = isoBox(88, 135, 38, 32, 25);
  const barnRoof = peakedRoof(barnBox.tS, barnBox.tE, barnBox.tN, barnBox.tW, 10);
  const fenceBox = isoBox(112, 148, 40, 32, 14);
  return (
    <g>
      <Shadow cx={104} cy={146} rx={54} ry={15}/>
      <polygon points={fenceBox.rightFace} fill="none" stroke="#795548" strokeWidth="2"/>
      <polygon points={fenceBox.leftFace} fill="none" stroke="#5D4037" strokeWidth="2"/>
      <polygon points={fenceBox.topFace} fill="rgba(76,175,80,0.12)"/>
      {[0.25, 0.5, 0.75].map((t, i) => {
        const b = lerp(fenceBox.bS, fenceBox.bE, t);
        const tt = lerp(fenceBox.tS, fenceBox.tE, t);
        return <line key={`p${i}`} x1={b[0]} y1={b[1]} x2={tt[0]} y2={tt[1]} stroke="#795548" strokeWidth="1.5"/>;
      })}
      {level >= 1 && (() => {
        const cp = lerp(fenceBox.tS, fenceBox.tN, 0.4);
        const cp2 = lerp(fenceBox.tE, fenceBox.tN, 0.5);
        return (
          <>
            <g transform={`translate(${cp[0] + 8},${cp[1] + 3})`}>
              <ellipse cx={0} cy={0} rx={8} ry={5} fill="#FAFAFA"/>
              <ellipse cx={-3} cy={-1} rx={3} ry={2.5} fill="#333" opacity={0.4}/>
              <circle cx={7} cy={-3} r={3.5} fill="#FAFAFA"/>
              <ellipse cx={9} cy={-1} rx={1.8} ry={1.2} fill="#FFCDD2"/>
              <circle cx={6.5} cy={-4} r={1} fill="#333"/>
            </g>
            {level >= 2 && (
              <g transform={`translate(${cp2[0]},${cp2[1] + 2})`}>
                <ellipse cx={0} cy={0} rx={7} ry={4.5} fill="#F5F5F5"/>
                <ellipse cx={4} cy={-1} rx={3} ry={2} fill="#8D6E63" opacity={0.5}/>
                <circle cx={6} cy={-3} r={3} fill="#F5F5F5"/>
                <circle cx={5.5} cy={-4} r={0.8} fill="#333"/>
              </g>
            )}
          </>
        );
      })()}
      <polygon points={barnBox.rightFace} fill={level === 3 ? "#FFCC80" : "#DEB887"}/>
      <polygon points={barnBox.leftFace} fill={level === 3 ? "#D4A050" : "#B8956A"}/>
      <rect x={lerp(barnBox.bS, barnBox.bE, 0.35)[0] - 4} y={barnBox.bS[1] - 15} width={8} height={14} rx={1} fill="#5D4037"/>
      <polygon points={barnRoof.frontSlope} fill={level === 3 ? "#A1887F" : "#8D6E63"}/>
      <polygon points={barnRoof.leftGable} fill="#6D4C41"/>
      <polygon points={barnRoof.rightGable} fill="#8D6E63"/>
      <line x1={barnRoof.ridgeSW[0]} y1={barnRoof.ridgeSW[1]} x2={barnRoof.ridgeNE[0]} y2={barnRoof.ridgeNE[1]} stroke="#4E342E" strokeWidth="1.5"/>
      {level === 3 && <polygon points={barnRoof.frontSlope} fill="rgba(255,215,0,0.1)"/>}
    </g>
  );
}

function FarmhouseSVG({ level }: { level: number }) {
  const box = isoBox(100, 140, 46, 40, 36);
  const roof = peakedRoof(box.tS, box.tE, box.tN, box.tW, 18);
  const wallR = level === 3 ? "#FFF8E1" : level === 2 ? "#FFE0B2" : "#FFECB3";
  const wallL = level === 3 ? "#FFE0B2" : level === 2 ? "#FFCC80" : "#FFD54F";
  const roofColor = level === 3 ? "#E65100" : level === 2 ? "#BF360C" : "#D84315";
  const roofSide = level === 3 ? "#BF360C" : level === 2 ? "#8D3B1A" : "#A63C1A";
  return (
    <g>
      <Shadow cx={100} cy={142} rx={46} ry={13}/>
      <polygon points={box.rightFace} fill={wallR}/>
      <polygon points={box.leftFace} fill={wallL}/>
      {[0.25, 0.55].map((t, i) => {
        const winBase = lerp(box.bS, box.bE, t);
        return (
          <g key={`wr${i}`}>
            <rect x={winBase[0] - 4} y={winBase[1] - 20 - t * 5} width={8} height={8} rx={1} fill="#BBDEFB" stroke="#5D4037" strokeWidth="0.8"/>
            <line x1={winBase[0]} y1={winBase[1] - 20 - t * 5} x2={winBase[0]} y2={winBase[1] - 12 - t * 5} stroke="#5D4037" strokeWidth="0.5"/>
          </g>
        );
      })}
      {[0.35].map((t, i) => {
        const winBase = lerp(box.bS, box.bW, t);
        return (
          <g key={`wl${i}`}>
            <rect x={winBase[0] - 4} y={winBase[1] - 18 - t * 4} width={7} height={7} rx={1} fill="#BBDEFB" stroke="#5D4037" strokeWidth="0.8"/>
          </g>
        );
      })}
      <rect x={lerp(box.bS, box.bE, 0.35)[0] - 5} y={box.bS[1] - 16} width={10} height={15} rx={1.5} fill="#5D4037"/>
      <circle cx={lerp(box.bS, box.bE, 0.35)[0] + 3} cy={box.bS[1] - 9} r={1.2} fill="#FFD700"/>
      <polygon points={roof.frontSlope} fill={roofColor}/>
      <polygon points={roof.leftGable} fill={roofSide}/>
      <polygon points={roof.rightGable} fill={roofColor}/>
      <line x1={roof.ridgeSW[0]} y1={roof.ridgeSW[1]} x2={roof.ridgeNE[0]} y2={roof.ridgeNE[1]} stroke="#4E342E" strokeWidth="2"/>
      {level >= 2 && (() => {
        const chimX = lerp(roof.ridgeSW, roof.ridgeNE, 0.7);
        return (
          <g>
            <rect x={chimX[0] - 3} y={chimX[1] - 12} width={6} height={14} fill="#795548"/>
            <rect x={chimX[0] - 4} y={chimX[1] - 14} width={8} height={3} fill="#5D4037"/>
          </g>
        );
      })()}
      {level === 3 && <>
        <polygon points={roof.frontSlope} fill="rgba(255,215,0,0.06)"/>
        <line x1={box.bS[0]} y1={box.bS[1]} x2={box.bE[0]} y2={box.bE[1]} stroke="#FFD700" strokeWidth="1.5" opacity="0.3"/>
      </>}
    </g>
  );
}

function WindmillSVG({ level }: { level: number }) {
  const towerW = 18;
  const towerD = 15;
  const towerH = level === 3 ? 55 : level === 2 ? 48 : 42;
  const tower = isoBox(100, 142, towerW, towerD, towerH);
  const capH = 10;
  const cap = isoBox(100 - 3, tower.tS[1] + 3, towerW + 6, towerD + 5, capH);
  const stoneR = level === 3 ? "#BDBDBD" : "#A0A0A0";
  const stoneL = level === 3 ? "#9E9E9E" : "#808080";
  const cx = (tower.tS[0] + tower.tE[0] + tower.tN[0] + tower.tW[0]) / 4;
  const cy = (tower.tS[1] + tower.tE[1] + tower.tN[1] + tower.tW[1]) / 4 - capH;
  return (
    <g>
      <Shadow cx={100} cy={144} rx={30} ry={10}/>
      <polygon points={tower.rightFace} fill={stoneR}/>
      <polygon points={tower.leftFace} fill={stoneL}/>
      {[0.2, 0.4, 0.6, 0.8].map((t, i) => {
        const a = lerp(tower.bS, tower.tS, t);
        const b = lerp(tower.bE, tower.tE, t);
        return <line key={i} x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} stroke="rgba(0,0,0,0.08)" strokeWidth="0.8"/>;
      })}
      {[0.3, 0.6].map((t, i) => {
        const p = lerp(tower.bS, tower.tS, t);
        const p2 = lerp(tower.bE, tower.tE, t);
        const wx = (p[0] + p2[0]) / 2;
        const wy = (p[1] + p2[1]) / 2;
        return <rect key={`w${i}`} x={wx - 3} y={wy - 3} width={5} height={5} rx={0.5} fill="#5D4037" opacity="0.6"/>;
      })}
      <rect x={lerp(tower.bS, tower.bE, 0.25)[0] - 3} y={tower.bS[1] - 12} width={6} height={11} rx={1} fill="#5D4037"/>
      <polygon points={cap.rightFace} fill={level === 3 ? "#8D6E63" : "#795548"}/>
      <polygon points={cap.leftFace} fill="#5D4037"/>
      <polygon points={cap.topFace} fill={level === 3 ? "#A1887F" : "#8D6E63"}/>
      <g style={{ transformOrigin: `${cx}px ${cy}px`, animation: "windmillSpin 4s linear infinite" }}>
        {[0, 72, 144, 216, 288].map(a => {
          const r = a * Math.PI / 180;
          const bladeLen = level === 3 ? 28 : level === 2 ? 24 : 20;
          const ex = cx + Math.sin(r) * bladeLen;
          const ey = cy - Math.cos(r) * bladeLen;
          const perpX = Math.cos(r) * 4;
          const perpY = Math.sin(r) * 4;
          return (
            <g key={a}>
              <polygon points={`${cx},${cy} ${ex + perpX},${ey + perpY} ${ex - perpX},${ey - perpY}`} fill={level === 3 ? "#5D4037" : "#4E342E"} opacity={0.85}/>
              <line x1={cx} y1={cy} x2={ex} y2={ey} stroke="#3E2723" strokeWidth="1.5"/>
            </g>
          );
        })}
        <circle cx={cx} cy={cy} r={4} fill="#5D4037"/>
        <circle cx={cx} cy={cy} r={2.5} fill="#8D6E63"/>
      </g>
      {level === 3 && <circle cx={cx} cy={cy} r={3} fill="#FFD700" opacity={0.4}/>}
    </g>
  );
}

function RedBarnSVG({ level }: { level: number }) {
  const box = isoBox(100, 142, 52, 44, 34);
  const roof = peakedRoof(box.tS, box.tE, box.tN, box.tW, 16);
  const barnR = level === 3 ? "#E53935" : level === 2 ? "#D32F2F" : "#C62828";
  const barnL = level === 3 ? "#C62828" : level === 2 ? "#B71C1C" : "#A41515";
  const roofC = level === 3 ? "#D32F2F" : "#B71C1C";
  return (
    <g>
      <Shadow cx={100} cy={144} rx={50} ry={14}/>
      <polygon points={box.rightFace} fill={barnR}/>
      <polygon points={box.leftFace} fill={barnL}/>
      <line x1={box.bS[0]} y1={box.bS[1]} x2={box.tS[0]} y2={box.tS[1]} stroke="white" strokeWidth="1.5" opacity="0.5"/>
      <line x1={box.bE[0]} y1={box.bE[1]} x2={box.tE[0]} y2={box.tE[1]} stroke="white" strokeWidth="1" opacity="0.3"/>
      {[0.5].map((t) => {
        const a = lerp(box.bS, box.bE, t);
        const b = lerp(box.tS, box.tE, t);
        return <line key="trim" x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} stroke="white" strokeWidth="1" opacity="0.4"/>;
      })}
      <rect x={lerp(box.bS, box.bE, 0.25)[0] - 7} y={box.bS[1] - 22} width={14} height={21} rx={1} fill="#5D4037"/>
      <line x1={lerp(box.bS, box.bE, 0.25)[0]} y1={box.bS[1] - 22} x2={lerp(box.bS, box.bE, 0.25)[0]} y2={box.bS[1] - 1} stroke="#3E2723" strokeWidth="1"/>
      <line x1={lerp(box.bS, box.bE, 0.25)[0] - 7} y1={box.bS[1] - 11} x2={lerp(box.bS, box.bE, 0.25)[0] + 7} y2={box.bS[1] - 11} stroke="#3E2723" strokeWidth="1"/>
      {level >= 2 && [0.3, 0.65].map((t, i) => {
        const p = lerp(box.bS, box.bW, t);
        return <rect key={i} x={p[0] - 3} y={p[1] - 16 - t * 3} width={6} height={5} rx={0.5} fill="#BBDEFB" stroke="#5D4037" strokeWidth="0.5"/>;
      })}
      <polygon points={roof.frontSlope} fill={roofC}/>
      <polygon points={roof.leftGable} fill="#B71C1C"/>
      <polygon points={roof.rightGable} fill={roofC}/>
      <line x1={roof.ridgeSW[0]} y1={roof.ridgeSW[1]} x2={roof.ridgeNE[0]} y2={roof.ridgeNE[1]} stroke="#8B0000" strokeWidth="2.5"/>
      <line x1={roof.ridgeSW[0]} y1={roof.ridgeSW[1]} x2={roof.ridgeNE[0]} y2={roof.ridgeNE[1]} stroke="white" strokeWidth="1" opacity="0.3"/>
      {level === 3 && <>
        <polygon points={roof.frontSlope} fill="rgba(255,215,0,0.08)"/>
        <circle cx={lerp(roof.ridgeSW, roof.ridgeNE, 0.5)[0]} cy={lerp(roof.ridgeSW, roof.ridgeNE, 0.5)[1] - 5} r={4} fill="#FFD700" opacity={0.4}/>
      </>}
    </g>
  );
}

function TractorSVG({ level }: { level: number }) {
  const shed = isoBox(80, 138, 34, 28, 22);
  const shedRoof = peakedRoof(shed.tS, shed.tE, shed.tN, shed.tW, 8);
  const bodyColor = level === 3 ? "#2E7D32" : level === 2 ? "#388E3C" : "#43A047";
  return (
    <g>
      <Shadow cx={100} cy={144} rx={48} ry={13}/>
      <polygon points={shed.rightFace} fill="#9E9E9E"/>
      <polygon points={shed.leftFace} fill="#757575"/>
      <polygon points={shedRoof.frontSlope} fill="#78909C"/>
      <polygon points={shedRoof.leftGable} fill="#607D8B"/>
      <polygon points={shedRoof.rightGable} fill="#78909C"/>
      <line x1={shedRoof.ridgeSW[0]} y1={shedRoof.ridgeSW[1]} x2={shedRoof.ridgeNE[0]} y2={shedRoof.ridgeNE[1]} stroke="#455A64" strokeWidth="1.5"/>
      <g transform="translate(120, 132)">
        <ellipse cx={0} cy={5} rx={14} ry={4} fill="rgba(0,0,0,0.12)"/>
        <rect x={-12} y={-10} width={20} height={14} rx={2} fill={bodyColor}/>
        <rect x={-14} y={-16} width={12} height={10} rx={2} fill={level === 3 ? "#1B5E20" : "#2E7D32"}/>
        <rect x={-13} y={-15} width={5} height={5} rx={1} fill="#BBDEFB" opacity={0.7}/>
        <circle cx={-8} cy={4} r={7} fill="#37474F"/>
        <circle cx={-8} cy={4} r={4.5} fill="#546E7A"/>
        <circle cx={-8} cy={4} r={2} fill="#37474F"/>
        <circle cx={8} cy={5} r={5} fill="#37474F"/>
        <circle cx={8} cy={5} r={3} fill="#546E7A"/>
        <circle cx={8} cy={5} r={1.5} fill="#37474F"/>
        <rect x={6} y={-12} width={3} height={5} rx={0.5} fill="#37474F"/>
        {level === 3 && <rect x={-12} y={-10} width={20} height={2} fill="#FFD700" opacity={0.3}/>}
      </g>
    </g>
  );
}

function GrainSiloSVG({ level }: { level: number }) {
  const siloCount = level === 1 ? 1 : level === 2 ? 2 : 3;
  const metalR = level === 3 ? "#CFD8DC" : "#B0BEC5";
  const metalL = level === 3 ? "#90A4AE" : "#78909C";
  return (
    <g>
      <Shadow cx={100} cy={144} rx={46} ry={13}/>
      {Array.from({ length: siloCount }).map((_, i) => {
        const offset = siloCount === 1 ? 0 : siloCount === 2 ? (i - 0.5) * 22 : (i - 1) * 20;
        const cx = 100 + offset;
        const cy = 142 - Math.abs(offset) * 0.3;
        const r = siloCount === 1 ? 18 : siloCount === 2 ? 15 : 13;
        const h = level === 3 ? 50 : level === 2 ? 44 : 40;
        return (
          <g key={i}>
            <ellipse cx={cx} cy={cy} rx={r} ry={r * 0.4} fill="rgba(0,0,0,0.1)"/>
            <rect x={cx - r} y={cy - h} width={r * 2} height={h} fill={metalR}/>
            <rect x={cx - r} y={cy - h} width={r} height={h} fill={metalL}/>
            {[0.25, 0.5, 0.75].map((t, j) => (
              <line key={j} x1={cx - r} y1={cy - h * t} x2={cx + r} y2={cy - h * t} stroke="rgba(0,0,0,0.08)" strokeWidth="1"/>
            ))}
            <ellipse cx={cx} cy={cy} rx={r} ry={r * 0.4} fill={metalR} stroke="#78909C" strokeWidth="1"/>
            <ellipse cx={cx} cy={cy - h} rx={r} ry={r * 0.4} fill={metalR} stroke="#78909C" strokeWidth="1"/>
            <ellipse cx={cx} cy={cy - h - r * 0.3} rx={r * 0.7} ry={r * 0.25} fill="#78909C"/>
            <polygon points={`${cx - r * 0.7},${cy - h - r * 0.3} ${cx},${cy - h - r * 0.8} ${cx + r * 0.7},${cy - h - r * 0.3}`} fill="#607D8B"/>
            <circle cx={cx} cy={cy - h - r * 0.8} r={2} fill="#455A64"/>
            {level === 3 && <line x1={cx - r} y1={cy - h * 0.3} x2={cx + r} y2={cy - h * 0.3} stroke="#FFD700" strokeWidth="1.5" opacity="0.3"/>}
          </g>
        );
      })}
      {siloCount >= 2 && (() => {
        const bx = 100 + (siloCount === 2 ? 11 : 20) + 8;
        const by = 142;
        const smallBox = isoBox(bx, by, 14, 12, 10);
        return (
          <g>
            <polygon points={smallBox.rightFace} fill="#8D6E63"/>
            <polygon points={smallBox.leftFace} fill="#6D4C41"/>
            <polygon points={smallBox.topFace} fill="#A1887F"/>
          </g>
        );
      })()}
    </g>
  );
}

function IrrigationSVG({ level }: { level: number }) {
  const box = isoBox(100, 142, 55, 55, 5);
  const pipeCount = level === 1 ? 2 : level === 2 ? 3 : 4;
  return (
    <g>
      <Shadow cx={100} cy={144} rx={52} ry={14}/>
      <polygon points={box.rightFace} fill="#2E7D32"/>
      <polygon points={box.leftFace} fill="#1B5E20"/>
      <polygon points={box.topFace} fill="#43A047"/>
      {Array.from({ length: pipeCount }).map((_, i) => {
        const t = (i + 1) / (pipeCount + 1);
        const a = lerp(box.tW, box.tS, t);
        const b = lerp(box.tN, box.tE, t);
        return (
          <g key={i}>
            <line x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} stroke="#78909C" strokeWidth={2.5} opacity={0.8}/>
            {[0.25, 0.5, 0.75].map((s, j) => {
              const sp = lerp(a, b, s);
              return (
                <g key={j}>
                  <circle cx={sp[0]} cy={sp[1]} r={2} fill="#90CAF9"/>
                  {level >= 2 && <circle cx={sp[0]} cy={sp[1] - 3} r={1.5} fill="#64B5F6" opacity={0.5}/>}
                </g>
              );
            })}
          </g>
        );
      })}
      {(() => {
        const cp = lerp(box.tS, box.tN, 0.5);
        return (
          <g>
            <rect x={cp[0] - 4} y={cp[1] - 18} width={8} height={16} rx={1} fill="#546E7A"/>
            <rect x={cp[0] - 5} y={cp[1] - 20} width={10} height={4} rx={1} fill="#455A64"/>
            <circle cx={cp[0]} cy={cp[1] - 22} r={3} fill="#78909C"/>
            {level >= 2 && (
              <>
                <line x1={cp[0]} y1={cp[1] - 22} x2={cp[0] - 12} y2={cp[1] - 16} stroke="#78909C" strokeWidth="1.5"/>
                <line x1={cp[0]} y1={cp[1] - 22} x2={cp[0] + 12} y2={cp[1] - 16} stroke="#78909C" strokeWidth="1.5"/>
              </>
            )}
          </g>
        );
      })()}
      {level === 3 && <>
        <polygon points={box.topFace} fill="rgba(100,181,246,0.1)"/>
        <polygon points={box.topFace} fill="none" stroke="#64B5F6" strokeWidth="1.5" opacity="0.3"/>
      </>}
    </g>
  );
}

export function BuildingSVG({ buildingId, level }: { buildingId: string; level: number }) {
  return (
    <svg viewBox="0 0 200 160" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
      {buildingId === "wheat_field" && <WheatFieldSVG level={level}/>}
      {buildingId === "vegetable_patch" && <VegetablePatchSVG level={level}/>}
      {buildingId === "apple_orchard" && <AppleOrchardSVG level={level}/>}
      {buildingId === "greenhouse" && <GreenhouseSVG level={level}/>}
      {buildingId === "chicken_coop" && <ChickenCoopSVG level={level}/>}
      {buildingId === "dairy_cows" && <DairyCowsSVG level={level}/>}
      {buildingId === "farmhouse" && <FarmhouseSVG level={level}/>}
      {buildingId === "windmill" && <WindmillSVG level={level}/>}
      {buildingId === "barn" && <RedBarnSVG level={level}/>}
      {buildingId === "tractor" && <TractorSVG level={level}/>}
      {buildingId === "silo" && <GrainSiloSVG level={level}/>}
      {buildingId === "irrigation" && <IrrigationSVG level={level}/>}
    </svg>
  );
}

export function LockedFieldSVG({ cost }: { cost: number }) {
  const box = isoBox(100, 130, 45, 45, 4);
  return (
    <svg viewBox="0 0 200 160" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
      <polygon points={box.rightFace} fill="#5A4A3A" opacity="0.5"/>
      <polygon points={box.leftFace} fill="#4A3A2A" opacity="0.5"/>
      <polygon points={box.topFace} fill="#6B5B4B" opacity="0.4"/>
      <polygon points={box.topFace} fill="none" stroke="#5A4A3A" strokeWidth="1.5" strokeDasharray="6 4" opacity="0.5"/>
      {[0.33, 0.66].map((t, i) => {
        const a = lerp(box.tW, box.tN, t);
        const b = lerp(box.tS, box.tE, t);
        return <line key={i} x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} stroke="#5A4A3A" strokeWidth="1" opacity="0.2" strokeDasharray="4 3"/>;
      })}
    </svg>
  );
}
