from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import unquote, urljoin, urlsplit

root = Path('out')
missing = set()
class Links(HTMLParser):
    def __init__(self, page):
        super().__init__()
        self.page = page
    def handle_starttag(self, tag, attrs):
        for key, value in attrs:
            if key not in ('href', 'src', 'poster') or not value or value.startswith('#'):
                continue
            url = urlsplit(urljoin('https://qtj.me/' + self.page, value))
            if url.netloc != 'qtj.me' or url.scheme not in ('https', 'http'):
                continue
            if url.path.startswith('/NetForge/'):
                continue
            target = root / unquote(url.path).lstrip('/')
            if not target.is_file() and not (target / 'index.html').is_file():
                missing.add((self.page, value))

assert (root / 'index.html').is_file(), 'Run pnpm build first'
assert not (root / 'legacy').exists(), 'Legacy archive in export'
assert (root / 'CNAME').read_text().strip() == 'qtj.me'
assert (root / '.nojekyll').is_file()
for page in root.rglob('*.html'):
    Links(page.relative_to(root).as_posix()).feed(page.read_text())
for page, link in sorted(missing):
    print(f'{page}: {link}')
assert not missing, f'{len(missing)} missing local targets'
print('Static export: all local HTML links and assets resolve.')
