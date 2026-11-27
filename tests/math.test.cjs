const test = require('node:test');
const assert = require('node:assert/strict');
const m = require('../app/math.js');
test('cache picks first strictly qualifying window, including re-decode of selected window',()=>{
  const windows=[{visibility:.2,beta:[1]},{visibility:.6,beta:[2]},{visibility:.7,beta:[3]},{visibility:.9,beta:[4]}];
  const r=m.betaCache(windows,.6);
  assert.equal(r.selected,2);assert.equal(r.held,3);assert.deepEqual(r.output,[[3],[3],[3],[3]]);
  assert.deepEqual(m.betaCache(windows,1).output,[[1],[2],[3],[4]]);
  assert.deepEqual(m.betaCache(windows,1,[9]).output,[[9],[9],[9],[9]]);
});
test('deep penetration and inclusive 5 mm boundary',()=>{
  assert.deepEqual(m.contact(-12),{signed:true,unsigned:false});
  assert.deepEqual(m.contact(5),{signed:true,unsigned:true});
  assert.deepEqual(m.contact(5.01),{signed:false,unsigned:false});
});
test('unmeasured predictions never alter masked MAE',()=>{
  assert.equal(m.maskedMAE([1,2],[0,null]).mae,1);
  assert.equal(m.maskedMAE([1,1000],[0,null]).mae,1);
  assert.notEqual(m.maskedMAE([1,2],[0,null]).zeroFilled,m.maskedMAE([1,1000],[0,null]).zeroFilled);
  assert.equal(m.maskedMAE([1],[null]).mae,null);
});
test('softmax distribution stays nonnegative and sums to supplied total, including zero',()=>{
  for(const total of [0,12,100]){
    const r=m.distribute([1000,-1000],[[1,0],[0,1],[.5,.5]],[0,0,0],total);
    assert.ok(r.values.every(v=>Number.isFinite(v)&&v>=0));
    assert.ok(Math.abs(r.values.reduce((a,b)=>a+b,0)-total)<1e-10);
  }
});
test('constructed chunk has 16x42x3 targets and hand-level future validity',()=>{
  const p=m.packDPP(10,5);
  assert.equal(p.target_displacements_m.length,16);
  assert.ok(p.target_displacements_m.every(r=>r.length===42&&r.every(v=>v.length===3)));
  assert.equal(p.keypoint_valid_mask.flat().filter(Boolean).length,16*21+4*21);
  assert.ok(Math.abs(p.target_displacements_m[15][0][0]-.024)<1e-12);
  assert.equal(p.keypoint_valid_mask[3][21],true);assert.equal(p.keypoint_valid_mask[4][21],false);
  assert.notEqual(m.packDPP(0,0).target_displacements_m[0][0][1],p.target_displacements_m[0][0][1]);
});
