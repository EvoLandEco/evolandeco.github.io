import { test } from 'node:test';
import assert from 'node:assert/strict';
import { observationTimeBounds, observationTimeLabel } from '../src/lib/atlas-health-time';
import type { AtlasObservationTime } from '../src/lib/atlas-contract';

const time=(start:string|null,end:string|null,precision:AtlasObservationTime['precision'],kind:AtlasObservationTime['kind']='sample_collection'):AtlasObservationTime=>({kind,extent:start&&end?'closed_interval':start?'point':end?'open_interval':'unknown',start:{value:start,status:start?'reported':'not_reported'},end:{value:end,status:end?'reported':'not_reported'},precision,certainty:'exact',label:'Source collection time',reason:'Date precision retained.'});
const dates=(t:AtlasObservationTime)=>observationTimeBounds(t)?.map(ms=>new Date(ms).toISOString().slice(0,10));
test('Timeline placement preserves days, leap months, years and incomplete dates',()=>{
 assert.deepEqual(dates(time('2024-02',null,'month')),['2024-02-01','2024-02-29']);
 assert.deepEqual(dates(time('2026-12','2027-02','month')),['2026-12-01','2027-02-28']);
 assert.deepEqual(dates(time('2026',null,'year')),['2026-01-01','2026-12-31']);
 assert.deepEqual(dates(time('2026-06-15',null,'day')),['2026-06-15','2026-06-15']);
 assert.equal(observationTimeBounds({...time('2022',null,'year','detection'),extent:'open_interval'}),null);
 assert.equal(observationTimeLabel({...time('2022',null,'year','detection'),extent:'open_interval'}),'2022 · end unknown');
 assert.deepEqual(dates(time('2022',null,'year','detection')),['2022-01-01','2022-12-31']);
 assert.equal(observationTimeBounds(time(null,'2026-06-15','day')),null);
 assert.equal(observationTimeBounds(time('2026-06-15',null,'day','reporting_cutoff')),null);
 assert.equal(observationTimeBounds(time('2026-06-15',null,'day','unknown')),null);
 assert.equal(observationTimeBounds(time('2026-07',null,'month','unknown')),null);
 assert.equal(observationTimeLabel(time('2026-07',null,'month','unknown')),'Jul 2026');
 assert.equal(observationTimeLabel(time('2026',null,'year','unknown')),'2026');
 assert.equal(observationTimeLabel(time('2026-07',null,'month')),'Jul 2026');
 assert.equal(observationTimeLabel(time('2026',null,'year')),'2026');
 assert.equal(observationTimeLabel({...time('2026-07',null,'month'),certainty:'approximately'}),'Jul 2026 · approximate');
});
