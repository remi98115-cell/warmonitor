# Warmonitor — Tableau de bord géopolitique live

Tableau de bord mondial temps réel : carte Leaflet, 20+ chaînes news live (YouTube), webcams OSINT zones de conflit, météo Open-Meteo avec alertes, séismes USGS, flux GDELT, prix crypto/forex, drag-drop des panneaux.

## Sources live (toutes gratuites, sans API key)

- **Carte** : OpenStreetMap / CartoDB dark
- **Séismes** : USGS Earthquake Hazards (M4.5+ semaine)
- **Catastrophes** : NASA EONET (volcans, incendies, tempêtes)
- **Météo** : Open-Meteo (60+ villes, alertes perturbations)
- **News vidéo** : YouTube Live (France 24, DW, Al Jazeera, Sky News, CNN-News18, etc.)
- **Webcams** : YouTube Live (OSINT aggregators zones de conflit)
- **Articles géopolitiques** : GDELT 2.0 DOC API (via proxy CORS)
- **Marchés** : CoinGecko (crypto) + ExchangeRate-API (forex)

## Lancer en local

Un simple serveur statique suffit. Exemple :

```bash
python -m http.server 8765
# puis ouvrir http://localhost:8765
```

## Déploiement

100% statique — déployable sur n'importe quel hébergeur gratuit :
- **Netlify Drop** : glisse le dossier sur https://app.netlify.com/drop
- **Vercel** : `vercel --prod` depuis le dossier
- **Cloudflare Pages** : connecte un repo git
- **GitHub Pages** : push + activation dans Settings

Aucun build requis. Aucune variable d'environnement.

## Architecture

- `index.html` — structure (top-bar, sidebar, dashboard masonry)
- `styles.css` — thème sombre monospace, responsive, multicol masonry
- `data.js` — fetchers live (GDELT, USGS, Open-Meteo, CoinGecko, etc.) + dataset curé
- `app.js` — logique Leaflet, rendu panneaux, drag-drop SortableJS, URL state, playback

## Fonctionnalités

- Carte interactive 35 couches (conflits, bases, nucléaire, cyber, séismes, météo, etc.)
- 10+ panneaux dashboard réorganisables par drag (ordre persistant localStorage)
- Ajouter/supprimer des panneaux via bouton dédié
- Recherche ⌘K, export CSV/JSON, thème clair/sombre
- PWA-ready, responsive (desktop/tablette/mobile)
