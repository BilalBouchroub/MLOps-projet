"""
Extrait le GeoJSON des communes d'El Jadida depuis le fichier HTML Folium.
Usage : python3 extract_geojson.py /tmp/map_eljadida.html
"""
import sys, re, json, os

html_path = sys.argv[1] if len(sys.argv) > 1 else '/tmp/map_eljadida.html'
out_path   = os.path.join(
    os.path.dirname(__file__),
    '../malops-frontend/public/eljadida-communes.geojson'
)

with open(html_path, 'r', encoding='utf-8') as f:
    content = f.read()

# Cherche l'argument de geo_json_..._add({...})
m = re.search(r'_add\((\{"bbox".*?"FeatureCollection"\})\)', content, re.DOTALL)
if not m:
    # Essai alternatif : cherche le FeatureCollection directement
    m = re.search(r'(\{"bbox"[^;]+?"FeatureCollection"\})', content, re.DOTALL)

if not m:
    print("❌ GeoJSON non trouvé dans le fichier HTML.")
    sys.exit(1)

geojson = json.loads(m.group(1))

# Nettoyer les propriétés inutiles (garder ce qui est utile pour la carte)
for feature in geojson.get('features', []):
    props = feature.get('properties', {})
    feature['properties'] = {
        'commune':        props.get('commune', props.get('NAME_4', '')),
        'id_commune':     props.get('id_commune', props.get('GID_4', '')),
        'niveau_stress':  props.get('niveau_stress', ''),
        'stress_hydrique':props.get('stress_hydrique', 0),
        'NDVI':           props.get('NDVI', 0),
        'LST':            props.get('LST', 0),
        'pluie':          props.get('pluie', 0),
    }

os.makedirs(os.path.dirname(out_path), exist_ok=True)
with open(out_path, 'w', encoding='utf-8') as f:
    json.dump(geojson, f, ensure_ascii=False)

print(f"✅ GeoJSON extrait : {len(geojson['features'])} communes")
print(f"   Sauvegardé → {out_path}")
communes = [f['properties']['commune'] for f in geojson['features']]
print(f"   Communes : {', '.join(sorted(set(communes)))}")
