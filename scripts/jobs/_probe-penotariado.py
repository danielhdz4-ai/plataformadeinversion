import re
import urllib.request

u = "https://www.penotariado.com/inmobiliario/es/home"
t = urllib.request.urlopen(u, timeout=30).read().decode("utf-8", "ignore")
print("len", len(t))
for pat in ["arcgis", "FeatureServer", "mapa", "geoserv", "notariado.org", "main"]:
    m = re.findall(r'https?://[^"\']+', t, re.I)
    hits = [x for x in m if pat.lower() in x.lower()]
    print(pat, len(hits))
    for x in hits[:8]:
        print(" ", x[:140])

js = re.findall(r'src="([^"]+\.js[^"]*)"', t)
print("js files", len(js))
for x in js[:15]:
    print(" ", x)
