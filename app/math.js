/* Deterministic teaching examples. No model weights or neural inference here. */
(function (root) {
  'use strict';
  function betaCache(windows, threshold, calibrated = null) {
    const selected = calibrated ? -1 : windows.findIndex(w => w.visibility > threshold);
    const cached = calibrated || (selected >= 0 ? windows[selected].beta : null);
    return { selected, cached, output: windows.map(w => (cached || w.beta).slice()),
      held: calibrated ? 0 : selected >= 0 ? selected + 1 : windows.length };
  }
  function contact(distance, threshold = 5) {
    return { signed: distance <= threshold, unsigned: Math.abs(distance) <= threshold };
  }
  function maskedMAE(predictions, targets) {
    const valid = targets.map((x, i) => x === null ? null : Math.abs(predictions[i] - x)).filter(x => x !== null);
    return { count: valid.length, mae: valid.length ? valid.reduce((a,b) => a+b,0)/valid.length : null,
      zeroFilled: predictions.reduce((s,p,i) => s + Math.abs(p - (targets[i] ?? 0)), 0)/predictions.length };
  }
  function distribute(features, weights, embedding, total) {
    const h = weights.map((w,i) => w.reduce((s,a,j) => s + a*features[j],0) + embedding[i]);
    const mx = Math.max(...h), e = h.map(x => Math.exp(x-mx)), sum = e.reduce((a,b) => a+b,0);
    const fractions = e.map(x => x/sum);
    return { h, fractions, values: fractions.map(x => total*x) };
  }
  function packDPP(anchor, missingFrom) {
    // 17 sampled instants: t = anchor and t + 1 ... t + 16 at 20 Hz.
    const points = t => Array.from({length:42}, (_,j) => [
      (j < 21 ? -.08 : .08) + (j%5)*.012 + .0015*t,
      .02*Math.sin(t/6) + Math.floor(j%21/5)*.016,
      .45 + .01*Math.cos(t/8) + (j%4)*.003]);
    const current = points(anchor);
    return { provenance: 'synthetic teaching example; not author data or API', fps:20,
      delta_definition: 'p(t+k) - p(t); teaching choice, not specified by RLHND appendix',
      coordinate_frame: 'fixed synthetic camera; no episode-origin transform',
      anchor_frame:anchor, input_keypoints_m:current,
      target_displacements_m:Array.from({length:16}, (_,k) => points(anchor+k+1).map((p,j) => p.map((x,d) => x-current[j][d]))),
      keypoint_valid_mask:Array.from({length:16}, (_,k) => Array.from({length:42},(_,j) => !(j>=21 && missingFrom>0 && k+1>=missingFrom))),
      omitted_inputs:['object point clouds','object/instruction embeddings','camera pose','contact targets'] };
  }
  const api = { betaCache, contact, maskedMAE, distribute, packDPP };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.LabMath = api;
})(typeof window !== 'undefined' ? window : this);
