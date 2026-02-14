import React, { useRef, useState, useEffect } from "react";
import WebGLCore from "./WebGLCore";

export default function SeeRightApp() {
  const videoRef = useRef(null);
  const [useCamera, setUseCamera] = useState(true);
  const [sourceEl, setSourceEl] = useState(null);

  const [sph, setSph] = useState(-2.0);
  const [cyl, setCyl] = useState(0.0);
  const [axis, setAxis] = useState(90);
  const [eyeOffset, setEyeOffset] = useState({x:0,y:0});

  useEffect(() => {
    if (useCamera && videoRef.current) {
      navigator.mediaDevices.getUserMedia({video: { facingMode: "user" }})
        .then(stream => {
          videoRef.current.srcObject = stream;
          videoRef.current.play();
          setSourceEl(videoRef.current);
        })
        .catch(err => { console.error(err); });
    }
  }, [useCamera]);

  const handleUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const img = new Image();
    img.onload = () => setSourceEl(img);
    img.src = URL.createObjectURL(file);
    setUseCamera(false);
  };

  return (
    <div style={{display:"flex", gap:20, padding:20}}>
      <div style={{width: "50%"}}>
        <div style={{marginBottom:10}}>
          <button onClick={() => { setUseCamera(true); setSourceEl(videoRef.current); }}>Use Camera</button>
          <input type="file" accept="image/*" onChange={handleUpload} />
        </div>

        <div style={{border:"1px solid #ccc", width:640, height:480}}>
          <WebGLCore imageElement={sourceEl} sph={sph} cyl={cyl} axisDeg={axis} eyeOffset={eyeOffset} width={640} height={480} />
        </div>

        <video ref={videoRef} style={{display:"none"}} />
      </div>

      <div style={{width:"40%"}}>
        <h3>Prescription</h3>
        <label>SPH: <input type="number" step="0.25" value={sph} onChange={e=>setSph(parseFloat(e.target.value)||0)} /></label><br/>
        <label>CYL: <input type="number" step="0.25" value={cyl} onChange={e=>setCyl(parseFloat(e.target.value)||0)} /></label><br/>
        <label>AXIS: <input type="number" step="1" value={axis} onChange={e=>setAxis(parseFloat(e.target.value)||0)} /></label><br/>
        <h4>Eye Offset</h4>
        <label>X: <input type="range" min={-0.5} max={0.5} step={0.01} value={eyeOffset.x} onChange={e=>setEyeOffset({...eyeOffset, x:parseFloat(e.target.value)})} /></label><br/>
        <label>Y: <input type="range" min={-0.5} max={0.5} step={0.01} value={eyeOffset.y} onChange={e=>setEyeOffset({...eyeOffset, y:parseFloat(e.target.value)})} /></label><br/>
        <button onClick={()=>{ navigator.clipboard?.writeText(`SPH=${sph}, CYL=${cyl}, AXIS=${axis}`); }}>Copy Presc</button>
      </div>
    </div>
  );
}
