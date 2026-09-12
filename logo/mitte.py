"""Prüft, ob das Zeichen im Bild wirklich mittig sitzt.

Sucht die farbigen Pixel (das Neon-Zeichen hebt sich in Sättigung und
Helligkeit sowohl vom dunklen als auch vom weißen Grund ab) und
vergleicht deren Mittelpunkt mit der Bildmitte.
"""
import sys, cv2, numpy as np

for f in sys.argv[1:]:
    img = cv2.imread(f)
    h, w = img.shape[:2]
    hsv = cv2.cvtColor(img, cv2.COLOR_BGR2HSV)
    maske = (hsv[:, :, 1] > 90) & (hsv[:, :, 2] > 110)
    ys, xs = np.nonzero(maske)
    if len(xs) == 0:
        print(f, 'kein Zeichen gefunden'); continue
    cx, cy = (xs.min() + xs.max()) / 2, (ys.min() + ys.max()) / 2
    print(f'{f}')
    print(f'  Zeichen: x {xs.min()}–{xs.max()}  y {ys.min()}–{ys.max()}')
    print(f'  Versatz zur Mitte: x {cx - w/2:+.1f} px   y {cy - h/2:+.1f} px')
    r = max(np.hypot(xs - w/2, ys - h/2).max(), 0)
    print(f'  weitester Punkt: {r:.0f} px von {w/2:.0f} (Kreisrand)')
