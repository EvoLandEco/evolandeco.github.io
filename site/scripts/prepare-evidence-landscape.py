"""Package an Evidence landscape study for a local website preview."""
import argparse, collections, csv, hashlib, itertools, json, pathlib

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('study', type=pathlib.Path)
parser.add_argument('--output', type=pathlib.Path, default=pathlib.Path('public/atlas-evidence-landscape'))
args = parser.parse_args()
def read(name): return json.loads((args.study / name).read_text())
def csv_rows(name):
    with (args.study / 'results' / name).open() as f: return list(csv.DictReader(f))
summary = read('results/summary.json')
rivers = read('river/rivers.json')
monthly = read('river/input.json')
assert summary['source_export_id'] == rivers['export'] == monthly['export']
labels = [{'id':r['disease_id'], 'name':r['label']} for r in csv_rows('diseases.csv')]
label_index = {r['id']:i for i,r in enumerate(labels)}
sources = [{'id':r['organization_id'], 'name':r['organization']} for r in csv_rows('source_removal.csv')]
source_index = {r['id']:i for i,r in enumerate(sources)}
documents = [{'id':r['document_id'], 'title':r['title'], 'date':r['publication'][:10], 'url':r['url'],
              'source':source_index[r['organization_id']], 'labels':[label_index[d] for d in json.loads(r['disease_ids'])],
              'entries':int(r['report_entry_count'])} for r in csv_rows('documents.csv')]
doc_index = {d['id']:i for i,d in enumerate(documents)}
bundles = [{'id':hashlib.sha256('\n'.join(b['disease_ids']).encode()).hexdigest()[:16],
            'labels':[label_index[d] for d in b['disease_ids']], 'records':b['record_ids'],
            'documents':[doc_index[d] for d in b['document_ids']]} for b in read('results/record_bundles.json')['sets']]
pair_docs = collections.defaultdict(set); pair_entries = collections.defaultdict(set)
for i,d in enumerate(documents):
    for p in itertools.combinations(sorted(d['labels']),2): pair_docs[p].add(i)
for b in bundles:
    for p in itertools.combinations(sorted(b['labels']),2): pair_entries[p].update(b['documents'])
pairs = [{'labels':list(p), 'documents':sorted(ds), 'entry_documents':sorted(pair_entries[p])} for p,ds in sorted(pair_docs.items())]
assert len(pairs)==summary['projection']['projection_edges']
assert sum(bool(p['entry_documents']) for p in pairs)==read('results/record_bundles.json')['same_entry_pairs']
removals=[]
for i,s in enumerate(sources):
    removed={j for j,d in enumerate(documents) if d['source']==i}
    lost_document=sum(set(p['documents'])<=removed for p in pairs)
    lost_entry=sum(bool(p['entry_documents']) and set(p['entry_documents'])<=removed for p in pairs)
    lost_bundles=sum(set(b['documents'])<=removed for b in bundles)
    removals.append({'source':i,'documents':len(removed),'document_pairs_lost':lost_document,'entry_pairs_lost':lost_entry,'bundles_lost':lost_bundles})
months=[]
for m,raw in zip(rivers['months'],monthly['months']):
    groups=[{'id':g['id'],'identity':g['identity'],'labels':[label_index[d] for d in g['members']],
             'documents':[doc_index[d] for d in g['documents']]} for g in m['groups']]
    assert len(set(g['identity'] for g in groups))==len(groups)
    months.append({'month':m['month'],'groups':groups,'documents':m['documents'],
                   'edges':[[label_index[a],label_index[b],w] for a,b,w in raw['edges']]})
null_pairs=[]
for example,g,c in zip(summary['top_pair_examples'],summary['nulls']['global']['pairs'],summary['nulls']['source_month']['pairs']):
    li=[label_index[example['disease_a']],label_index[example['disease_b']]]
    assert li==[g['a'],g['b']]==[c['a'],c['b']]
    null_pairs.append({'labels':li,'observed':example['shared_documents'],
                       'global':[g['q025'],g['mean'],g['q975']], 'conditional':[c['q025'],c['mean'],c['q975']]})
data={'version':1,'export_id':rivers['export'],'scope':summary['scope'],'labels':labels,'sources':sources,
      'documents':documents,'bundles':bundles,'pairs':pairs,'removals':removals,'months':months,
      'null_model':{'draws':399,'pairs':null_pairs,'strata':summary['nulls']['source_month']['strata'],
                    'mutable_strata':summary['nulls']['source_month']['mutable_strata']}}
args.output.mkdir(parents=True,exist_ok=True)
blob=(json.dumps(data,separators=(',',':'),ensure_ascii=False)+'\n').encode()
(args.output/'study.json').write_bytes(blob)
manifest={'version':1,'export_id':data['export_id'],'bytes':len(blob),'sha256':hashlib.sha256(blob).hexdigest()}
(args.output/'manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
print(json.dumps(manifest,indent=2))
