#!/usr/bin/env python3
"""
Aviso por correo de las solicitudes de acceso al cronómetro (lo lanza .github/workflows/avisar-solicitudes.yml).

Lee la colección «entrenadores» de Firestore con una cuenta de servicio (secreto FIREBASE_SA) y busca las
solicitudes pendientes que todavía no se avisaron: sin admin, sin aprobar, sin bloquear y sin «avisado».
  python avisar_solicitudes.py buscar   → escribe el cuerpo del correo en $AVISO_CUERPO y los correos en $AVISO_IDS
  python avisar_solicitudes.py marcar   → marca esas solicitudes con avisado: true (se llama solo si el correo salió)
"""
import json, os, sys

APP = 'https://andresvazquez11.github.io/Club-Natacion-Axarquia/cronometro/'


def pendientes(docs):
    """[(correo, datos)] de las solicitudes sin aprobar, sin bloquear y sin avisar, de la más antigua a la más nueva."""
    out = [(i, d) for i, d in docs
           if d.get('admin') is not True and d.get('aprobado') is not True
           and d.get('bloqueado') is not True and d.get('avisado') is not True]
    return sorted(out, key=lambda x: x[1].get('alta') or 0)


def cuerpo(lista):
    n = len(lista)
    lineas = [f"🔔 {'Una persona ha' if n == 1 else f'{n} personas han'} pedido acceso al cronómetro del club:", '']
    for correo, d in lista:
        lineas.append(f"  • {d.get('nombre') or '(sin nombre)'} — {correo}")
    lineas += ['', 'Para aprobarla o rechazarla: abre el cronómetro → menú ⋯ → 👥 Entrenadores → Aprobar / Rechazar.',
               APP, '', 'Mientras no la apruebes, esa persona no ve nada (ni en el cronómetro ni en la web).']
    return '\n'.join(lineas)


def _db():
    import firebase_admin
    from firebase_admin import credentials, firestore
    firebase_admin.initialize_app(credentials.Certificate(json.loads(os.environ['FIREBASE_SA'])))
    return firestore.client()


def main():
    accion = sys.argv[1] if len(sys.argv) > 1 else 'buscar'
    db = _db()
    if accion == 'buscar':
        lista = pendientes([(d.id, d.to_dict() or {}) for d in db.collection('entrenadores').stream()])
        print(f'{len(lista)} solicitud(es) nueva(s)')
        with open(os.environ['AVISO_IDS'], 'w') as f:
            json.dump([c for c, _ in lista], f)
        with open(os.environ['AVISO_CUERPO'], 'w') as f:
            f.write(cuerpo(lista) if lista else '')
    elif accion == 'marcar':
        ids = json.load(open(os.environ['AVISO_IDS']))
        for c in ids:
            db.collection('entrenadores').document(c).update({'avisado': True})
        print(f'{len(ids)} marcada(s) como avisada(s)')


if __name__ == '__main__':
    try:
        main()
    except Exception as e:   # en las revisiones automáticas (cada 10 min) un fallo no debe llenar el correo de avisos
        if os.environ.get('EVENTO') == 'schedule':
            print('No se pudo revisar las solicitudes:', e); sys.exit(0)
        raise
