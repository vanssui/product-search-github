#!/usr/bin/env python3
"""Copy the exact v71 HtmlService UI (HTML/CSS/client JS) to GitHub Pages.

No server-side Apps Script code, IDs, credentials or source spreadsheet values
are published. CSS and frontend JavaScript are copied unchanged inside HTML.
"""
from pathlib import Path
import re, sys, json, hashlib
repo=Path(__file__).resolve().parents[1]
if len(sys.argv)!=2:
    raise SystemExit('Usage: python3 tools/sync-v71-view.py /path/to/verified-v71/src')
source=Path(sys.argv[1]).resolve()
target=repo/'frontend/public/v71'
target.mkdir(parents=True,exist_ok=True)
included={}
def resolve_include(match):
    name=match.group(1)
    assert name in ('Styles','StylesSaaS','OperationClient','JavaScript','JavaScriptSaaS'), name
    data=(source/(name+'.html')).read_text(encoding='utf-8')
    included[name+'.html']=hashlib.sha256(data.encode()).hexdigest()
    return data
manifest={}
for variant,src in [('index.html','IndexSaaS.html'),('classic.html','Index.html')]:
    html=(source/src).read_text(encoding='utf-8')
    manifest[src]=hashlib.sha256(html.encode()).hexdigest()
    html=re.sub(r'<\?!=\s*include_\(\s*\'([^\']+)\'\s*\)\s*;?\s*\?>',resolve_include,html)
    assert '<?!=' not in html,src
    html=html.replace('<head>','<head>\n<!-- Native v71 GitHub Pages mirror. Google Script transport replaced with a safe API adapter. -->\n<script src="./runtime-config.js"></script>\n<script src="./bridge.js"></script>',1)
    (target/variant).write_text(html,encoding='utf-8')
manifest.update(included)
(target/'V71_SOURCE_HASHES.json').write_text(json.dumps({'source':'immutable production v71, 2026-11-23','sha256':manifest},ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print('Created',list(target.glob('*.html')),'sourceHashes',len(manifest))
