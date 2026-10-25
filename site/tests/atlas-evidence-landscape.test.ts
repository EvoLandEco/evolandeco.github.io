import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseEvidenceLandscape, landscapeRivers, sourceSupport, type EvidenceLandscape } from '../src/lib/atlas-evidence-landscape';

const exportId='a'.repeat(64);
function fixture(): EvidenceLandscape {
  return {version:1,export_id:exportId,scope:{publication_from:'2026-01-01',publication_until:'2026-02-28',capture_until:'2026-03-01'},
    labels:[{id:'a',name:'A'},{id:'b',name:'B'},{id:'c',name:'C'}],sources:[{id:'one',name:'One'},{id:'two',name:'Two'}],
    documents:[{id:'d1',title:'One',url:'https://example.org/1',date:'2026-01-01',source:0,labels:[0,1],entries:2},{id:'d2',title:'Two',url:'https://example.org/2',date:'2026-02-01',source:1,labels:[0,1,2],entries:1}],
    bundles:[{id:'ab',labels:[0,1],records:['r1'],documents:[0,1]}],pairs:[{labels:[0,1],documents:[0,1],entry_documents:[0]}],removals:[],
    months:[{month:'2026-01',documents:1,edges:[[0,1,1]],groups:[{id:'jan-a',identity:1,labels:[0,1],documents:[0]}]},
      {month:'2026-02',documents:1,edges:[[0,2,1]],groups:[{id:'feb-a',identity:1,labels:[0,2],documents:[1]},{id:'feb-b',identity:0,labels:[1],documents:[1]}]}],
    null_model:{draws:399,strata:2,mutable_strata:1,pairs:[{labels:[0,1],observed:2,global:[0,1,2],conditional:[1,1.5,2]}]}};
}
test('River splits preserve exact shared labels, without inventing persistence for newly present labels',()=>{
  const data=parseEvidenceLandscape(fixture(),exportId);
  assert.deepEqual(landscapeRivers(data.months),[
    {source:'jan-a',target:'feb-a',labels:[0],month:0},{source:'jan-a',target:'feb-b',labels:[1],month:0},
  ]);
  assert.equal(landscapeRivers(data.months).reduce((n,l)=>n+l.labels.length,0),2);
  assert.deepEqual(sourceSupport(data,[0,0,1]),[{source:0,count:1},{source:1,count:1}]);
});
test('Release identity, membership partitions and support bounds are checked before display',()=>{
  assert.throws(()=>parseEvidenceLandscape(fixture(),'b'.repeat(64)),/another dataset/);
  const bounds=fixture();bounds.bundles[0].documents.push(99);assert.throws(()=>parseEvidenceLandscape(bounds,exportId),/membership/);
  const overlap=fixture();overlap.months[1].groups[1].labels=[0,1];assert.throws(()=>parseEvidenceLandscape(overlap,exportId),/membership/);
  const identities=fixture();identities.months[1].groups[1].identity=1;assert.throws(()=>parseEvidenceLandscape(identities,exportId),/membership/);
  const support=fixture();support.pairs[0].documents=[0];support.pairs[0].entry_documents=[1];assert.throws(()=>parseEvidenceLandscape(support,exportId),/exceeds/);
});
