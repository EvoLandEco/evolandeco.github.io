import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {TABLES,decodeBrowserCore,BROWSER_TRANSPORT_VERSION} from '../src/lib/atlas-vendor/browser/0.3/browser_transport.js';
import {compactFigureIdentity} from '../src/lib/atlas-vendor/browser/0.3/site_view.js';
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const encode=value=>Buffer.from(JSON.stringify(value));
const fingerprint=bytes=>({sha256:hash(bytes),bytes:bytes.length});
const pick=(row,keys)=>Object.fromEntries(keys.map(k=>{assert(Object.hasOwn(row,k),`Missing ${k}`);return [k,row[k]];}));
const get=(data,name)=>name.startsWith('metrics.')?data.metrics[name.slice(8)]:data[name];
// Tuple encoding follows ATLAS export_browser_transport.mjs.
export function makeCore(site,exportId) {
  const strings=[],stringIds=new Map(),sets=[],setIds=new Map(),figures=new Map();
  const text=value=>{assert.equal(typeof value,'string');if(!stringIds.has(value)){stringIds.set(value,strings.length);strings.push(value);}return stringIds.get(value);};
  const support=value=>{
    assert.equal(value.rule,'all_supporting_records_in_window');assert.equal(value.partial,'hide_relationship_keep_visible_assertions');
    const ids=value.record_ids.map(text),key=JSON.stringify(ids);
    if(!setIds.has(key)){setIds.set(key,sets.length);sets.push(ids);}return setIds.get(key);
  };
  const tables={};
  for(const [name,spec] of Object.entries(TABLES)) {
    const values=get(site,name);
    const rows=values.map(source=>{
      let row=source;
      if(name==='metrics.measures') {
        const key=compactFigureIdentity(source);
        if(key!==null&&!figures.has(key))figures.set(key,figures.size);
        row={...source,source_record_id:source.source_reference.record_id,evidence_record_ids:source.evidence_references.map(e=>e.record_id),compact_figure_id:key===null?null:figures.get(key)};
      }
      if(name==='metrics.reviewed_series')row={...source,evidence_ids:source.evidence.map(e=>e.id)};
      return spec.columns.map((key,i)=>{
        assert(Object.hasOwn(row,key),`Missing ${name}.${key}`);const v=row[key],mode=spec.encoding[i];
        return v===null?null:mode==='string'?text(v):mode==='strings'?v.map(text):mode==='eligibility'?support(v):v;
      });
    });
    tables[name]={...spec,rows};
  }
  const core={transport_version:BROWSER_TRANSPORT_VERSION,source_export_id:exportId,
    metadata:{...pick(site,['contract_version','snapshot','reviewed_chains']),metrics:pick(site.metrics,['contract_version','coverage'])},
    strings,eligibility_record_sets:sets,tables};
  decodeBrowserCore(core,exportId);
  return core;
}

export function browserFixture(input,map) {
  const mapBytes=encode(map), metricsBytes=encode(input.metrics);
  const site={...input,snapshot:{...input.snapshot,source_snapshot_sha256:hash(mapBytes),metrics_sha256:hash(metricsBytes)}};
  const siteBytes=encode(site), exportId=hash(siteBytes), bodies={};
  const source={manifest:{path:'manifest.json',...fingerprint(encode({synthetic:true}))},site:{path:'atlas-site.json',...fingerprint(siteBytes)},map:{path:'map.json',...fingerprint(mapBytes)},metrics_sha256:hash(metricsBytes),site_contract_version:'1.8.0',selector:{path:'view.mjs',...fingerprint(readFileSync('src/lib/atlas-vendor/browser/0.3/site_view.js'))}};
  const manifest={transport_version:'0.3.0',source_export_id:exportId,source,core:'core.json',map_core:'map-core.json',detail_index:'detail-index.json',selector:'browser_transport.js',assets:{},partitions:[],reconstruction:{metadata:{site:{},map:{}},collections:{}}};
  const add=(name,value,kind,raw=false)=>{const bytes=raw?value:encode(value);bodies[name]=bytes;manifest.assets[name]={...fingerprint(bytes),kind};};
  add('core.json',makeCore(site,exportId),'core');
  add('map-core.json',{transport_version:'0.3.0',source_export_id:exportId,...pick(map,['tracks','map_links','relationships']),records:map.records.map(({claims,...row})=>row)},'map-core');
  for(const name of ['browser_transport.js','browser_tables.js','site_view.js'])add(name,readFileSync('src/lib/atlas-vendor/browser/0.3/'+name),'selector',true);
  const collections={};
  for(const [prefix,object] of [['site',site],['site.metrics',site.metrics],['map',map]]) for(const [name,values] of Object.entries(object)) {
    if(!Array.isArray(values))continue;
    const collection=prefix+'.'+name,path='details/'+collection+'.json',owner=collection;
    const rows=values.map((value,ordinal)=>({collection,ordinal,id:value?.id??value?.measure_id??value?.series_id??value?.finding_id??value?.conflict_id??value?.context_id??value?.record_id??value?.code??null,value}));
    const index=manifest.partitions.length;
    manifest.reconstruction.collections[collection]=rows.length;
    collections[collection]=rows.map(row=>[row.id,index]);
    if(!rows.length)continue;
    add(path,{transport_version:'0.3.0',source_export_id:exportId,owner,rows},'detail');
    manifest.partitions.push({path,owner,rows:rows.length});
  }
  add('detail-index.json',{transport_version:'0.3.0',source_export_id:exportId,partitions:manifest.partitions.map(p=>p.path),collections},'detail-index');
  const manifestBytes=encode(manifest),descriptor=fingerprint(manifestBytes),root=`/releases/${exportId}`,browserRoot=`${root}/browser/${descriptor.sha256}`;
  const release={version:1,export_id:exportId,published_at:'2026-10-07T00:00:00Z',cycle:null,mode:'initial',contract_version:'1.8.0',selector_sha256:source.selector.sha256,assets:{'atlas-site.json':fingerprint(siteBytes),'map.json':fingerprint(mapBytes),'metrics.json':fingerprint(metricsBytes)},browser:{transport_version:'0.3.0',manifest:descriptor}};
  return {release,bodies:Object.fromEntries([['/current.json',encode(release)],[`${root}/atlas-site.json`,siteBytes],[`${root}/map.json`,mapBytes],[`${root}/metrics.json`,metricsBytes],[`${browserRoot}/manifest.json`,manifestBytes],...Object.entries(bodies).map(([path,bytes])=>[`${browserRoot}/${path}`,bytes])])};
}
export async function routeBrowserFixture(page,site,map) {
  const fixture=browserFixture(site,map);
  await page.route(/\/(?:current\.json|releases\/|daily\/)/,route=>{
    const body=fixture.bodies[new URL(route.request().url()).pathname];
    return body?route.fulfill({contentType:'application/json',body}):new URL(route.request().url()).pathname.startsWith('/daily/')?route.fulfill({status:404,body:''}):route.abort();
  });
  return fixture;
}
