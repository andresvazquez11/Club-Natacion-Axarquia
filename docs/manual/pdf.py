from playwright.sync_api import sync_playwright
import pypdfium2 as pdfium, glob, os
from PIL import Image
with sync_playwright() as pw:
    b=pw.chromium.launch(); p=b.new_page(); p.goto('file:///private/tmp/claude-501/-Users-hectorandresvazquezriquelme-Desktop-automoviles-rueda/28d0bac7-ced3-464f-adfa-72fb6ce5e559/scratchpad/manual/manual.html'); p.wait_for_timeout(1500)
    p.pdf(path='/private/tmp/claude-501/-Users-hectorandresvazquezriquelme-Desktop-automoviles-rueda/28d0bac7-ced3-464f-adfa-72fb6ce5e559/scratchpad/manual/manual.pdf', format='A4', print_background=True, margin={'top':'13mm','bottom':'15mm','left':'14mm','right':'14mm'},
          display_header_footer=True, header_template='<span></span>',
          footer_template='<div style="font-size:8px;color:#888;width:100%;text-align:center">Manual de uso · Estadísticas C.N. Axarquía · <span class="pageNumber"></span>/<span class="totalPages"></span></div>')
    b.close()
for f in glob.glob('pg/*.png'): os.remove(f)
pdf=pdfium.PdfDocument('/private/tmp/claude-501/-Users-hectorandresvazquezriquelme-Desktop-automoviles-rueda/28d0bac7-ced3-464f-adfa-72fb6ce5e559/scratchpad/manual/manual.pdf'); n=len(pdf); print(n,'páginas')
ims=[pdf[i].render(scale=0.55).to_pil().convert('RGB') for i in range(n)]
w,h=ims[0].size
for part in range(0,n,10):
    g=ims[part:part+10]; sh=Image.new('RGB',(5*(w+8),2*(h+8)),'#888')
    for k,i in enumerate(g): sh.paste(i,((k%5)*(w+8),(k//5)*(h+8)))
    sh.save(f'pages{part//10}.png')
for i,im in enumerate(ims): im.save(f'pg/p-{i+1:02d}.png')
