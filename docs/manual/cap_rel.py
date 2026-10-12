import sys
src = open('capturas.py').read().split('with sync_playwright() as pw:')[0]
sys.argv = ['x', 'z', 'https://andresvazquez11.github.io/Club-Natacion-Axarquia/']
exec(src)
with sync_playwright() as pw:
    br = pw.chromium.launch()
    ctx, p = nueva(br, 'temporada.html#club/ALE/relevos')
    p.evaluate("document.querySelectorAll('details').forEach(d => d.open = !d.closest('.note'))"); p.wait_for_timeout(400)
    zona(p, 'r_card', ['Thomas Capelli', '.card.rel'], ['Mejores clubes', 'details'], maxh=1150)
    zona(p, 'r_falta', ['Jose Conejero Aguilera', 'details'], maxh=900)
    br.close()
