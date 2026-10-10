import os, json, sys
from pathlib import Path

# Setup semantic extraction
detect = json.loads(Path('graphify-out/.graphify_detect.json').read_text(encoding="utf-8"))
all_files = [f for cat in ('document', 'paper', 'image') for f in detect['files'].get(cat, [])]

if not all_files:
    Path('graphify-out/.graphify_semantic.json').write_text(json.dumps({'nodes':[],'edges':[],'hyperedges':[],'input_tokens':0,'output_tokens':0}), encoding='utf-8')
    print("No semantic files to extract.")
    sys.exit(0)

# We check cache first
from graphify.cache import check_semantic_cache, save_semantic_cache
SPEC_PATH = 'C:/Users/User/.gemini/config/skills/graphify/references/extraction-spec.md'
cached_nodes, cached_edges, cached_hyperedges, uncached = check_semantic_cache(all_files, root='.', prompt_file=SPEC_PATH)

if cached_nodes or cached_edges or cached_hyperedges:
    Path('graphify-out/.graphify_cached.json').write_text(json.dumps({'nodes': cached_nodes, 'edges': cached_edges, 'hyperedges': cached_hyperedges}, ensure_ascii=False), encoding="utf-8")
else:
    Path('graphify-out/.graphify_cached.json').unlink(missing_ok=True)
Path('graphify-out/.graphify_uncached.txt').write_text('\n'.join(uncached), encoding="utf-8")

if uncached:
    print(f"Extracting {len(uncached)} files semantically using graphify.llm...")
    try:
        from graphify.llm import extract_corpus_parallel
        new_result = extract_corpus_parallel(uncached, backend='gemini')
    except Exception as e:
        print(f"Error extracting with Gemini: {e}")
        # fallback to empty if no key or error
        new_result = {'nodes':[],'edges':[],'hyperedges':[],'input_tokens':0,'output_tokens':0}
else:
    new_result = {'nodes':[],'edges':[],'hyperedges':[],'input_tokens':0,'output_tokens':0}

saved = save_semantic_cache(new_result.get('nodes', []), new_result.get('edges', []), new_result.get('hyperedges', []), root='.', allowed_source_files=uncached, prompt_file=SPEC_PATH)

cached = json.loads(Path('graphify-out/.graphify_cached.json').read_text(encoding="utf-8")) if Path('graphify-out/.graphify_cached.json').exists() else {'nodes':[],'edges':[],'hyperedges':[]}
all_nodes = cached['nodes'] + new_result.get('nodes', [])
all_edges = cached['edges'] + new_result.get('edges', [])
all_hyperedges = cached.get('hyperedges', []) + new_result.get('hyperedges', [])
seen = set()
deduped = []
for n in all_nodes:
    if n['id'] not in seen:
        seen.add(n['id'])
        deduped.append(n)

merged = {
    'nodes': deduped,
    'edges': all_edges,
    'hyperedges': all_hyperedges,
    'input_tokens': new_result.get('input_tokens', 0),
    'output_tokens': new_result.get('output_tokens', 0),
}
Path('graphify-out/.graphify_semantic.json').write_text(json.dumps(merged, indent=2, ensure_ascii=False), encoding="utf-8")
print(f"Semantic Extraction complete - {len(deduped)} nodes, {len(all_edges)} edges")
