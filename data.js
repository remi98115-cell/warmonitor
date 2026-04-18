// Argos — data registry
// Layer definitions + curated static datasets + live API fetchers
// Written from scratch. Public data sources: USGS, NASA EONET, NASA FIRMS,
// Open-Meteo, CISA, GDELT, ACLED (demo), IAEA public list, OSM Overpass.

window.WM = window.WM || {};

// ---------- LAYER REGISTRY ----------
WM.LAYERS = [
  { id: "iranAttacks",   icon: "🎯",  label: "Attaques iraniennes",          color: "#ff3040", cat: "geo" },
  { id: "hotspots",      icon: "🎯",  label: "Points chauds renseignement",  color: "#ff6b9a", cat: "geo" },
  { id: "conflicts",     icon: "⚔",  label: "Zones de conflit",             color: "#ff3040", cat: "geo" },
  { id: "bases",         icon: "🏛",  label: "Bases militaires",             color: "#5cc2ff", cat: "mil" },
  { id: "nuclear",       icon: "☢",  label: "Sites nucléaires",             color: "#c86bff", cat: "nuclear" },
  { id: "gamma",         icon: "⚠",  label: "Irradiateurs gamma",           color: "#ffe84a", cat: "nuclear" },
  { id: "radiation",     icon: "☢",  label: "Surveillance des radiations",  color: "#c86bff", cat: "nuclear" },
  { id: "cosmodromes",   icon: "🚀",  label: "Cosmodromes",                  color: "#b59aff", cat: "space" },
  { id: "cables",        icon: "🔌",  label: "Câbles sous-marins",           color: "#56d6c7", cat: "infra" },
  { id: "pipelines",     icon: "🛢",  label: "Oléoducs et gazoducs",         color: "#ffb020", cat: "infra" },
  { id: "datacenters",   icon: "🖥",  label: "Centres de données IA",        color: "#33d1ff", cat: "infra" },
  { id: "military",      icon: "✈",  label: "Activité militaire",           color: "#7a8bff", cat: "mil" },
  { id: "shipping",      icon: "🚢",  label: "Trafic maritime",              color: "#4fc3f7", cat: "trade" },
  { id: "trade",         icon: "⚓",  label: "Routes commerciales",          color: "#22a3ff", cat: "trade" },
  { id: "flights",       icon: "✈",  label: "Retards de vols",              color: "#ff8a3b", cat: "trade" },
  { id: "protests",      icon: "📢",  label: "Manifestations",               color: "#ff9f43", cat: "social" },
  { id: "ucdp",          icon: "⚔",  label: "Événements UCDP",              color: "#ff5050", cat: "geo" },
  { id: "displacement",  icon: "👥",  label: "Flux de déplacement",          color: "#ff79b0", cat: "social" },
  { id: "climate",       icon: "🌫",  label: "Anomalies climatiques",        color: "#4fc3f7", cat: "env" },
  { id: "weather",       icon: "⛈",  label: "Alertes météo",                color: "#22a3ff", cat: "env" },
  { id: "outages",       icon: "📡",  label: "Pannes Internet",              color: "#ff8a3b", cat: "cyber" },
  { id: "cyberThreats",  icon: "🛡",  label: "Menaces cyber",                color: "#00e5ff", cat: "cyber" },
  { id: "natural",       icon: "🌋",  label: "Événements naturels",          color: "#ffd25f", cat: "env", live: true },
  { id: "fires",         icon: "🔥",  label: "Incendies",                    color: "#ff4500", cat: "env", live: true },
  { id: "waterways",     icon: "⚓",  label: "Voies navigables stratégiques",color: "#22a3ff", cat: "trade" },
  { id: "economic",      icon: "💰",  label: "Centres économiques",          color: "#22d39a", cat: "econ" },
  { id: "minerals",      icon: "💎",  label: "Minéraux critiques",           color: "#ff7a3b", cat: "econ" },
  { id: "gps",           icon: "📡",  label: "Brouillage GPS",               color: "#ff3b5c", cat: "cyber" },
  { id: "orbital",       icon: "🛰",  label: "Surveillance orbitale",        color: "#9b6bff", cat: "space" },
  { id: "instability",   icon: "🌎",  label: "Instabilité CII",              color: "#ff7a5c", cat: "geo" },
  { id: "resilience",    icon: "📈",  label: "Résilience",                   color: "#22d39a", cat: "econ", locked: true },
  { id: "sanctions",     icon: "🚫",  label: "Sanctions",                    color: "#9b6bff", cat: "geo" },
  { id: "daynight",      icon: "🌓",  label: "Jour/Nuit",                    color: "#888",    cat: "env" },
  { id: "webcams",       icon: "📷",  label: "Webcams en direct",            color: "#ffb020", cat: "infra" },
  { id: "disease",       icon: "🦠",  label: "Épidémies de maladies",        color: "#ff6bff", cat: "social" },
];

// ---------- REGIONAL VIEW BBOXES ----------
WM.VIEWS = {
  global:   { center: [20, 0],    zoom: 2 },
  americas: { center: [15, -85],  zoom: 3 },
  mena:     { center: [28, 40],   zoom: 4 },
  europe:   { center: [52, 15],   zoom: 4 },
  asia:     { center: [30, 100],  zoom: 3 },
  latam:    { center: [-15, -60], zoom: 3 },
  africa:   { center: [2, 20],    zoom: 3 },
  oceania:  { center: [-25, 140], zoom: 3 },
};

// ---------- STATIC DATASETS ----------
// Each item: { id, lat, lon, title, desc, sev, date (ISO), tags:[], url? }

WM.STATIC = {
  // Known historical / recent conflict zones (curated)
  conflicts: [
    { lat: 50.45, lon: 30.52, title: "Ukraine — front de l'Est",        desc: "Opérations actives en Donbass et Kharkiv.",     sev: "critical", date: daysAgo(2), tags: ["Ukraine","Russie"] },
    { lat: 31.50, lon: 34.47, title: "Bande de Gaza",                   desc: "Opérations militaires et frappes aériennes.",   sev: "critical", date: daysAgo(1), tags: ["Israël","Hamas"] },
    { lat: 33.51, lon: 36.29, title: "Syrie — zones contestées",        desc: "Affrontements dans le nord-ouest.",             sev: "high",     date: daysAgo(5), tags: ["Syrie"] },
    { lat: 15.55, lon: 32.53, title: "Soudan — guerre civile",          desc: "Combats FAS vs RSF à Khartoum et Darfour.",     sev: "critical", date: daysAgo(3), tags: ["Soudan"] },
    { lat: 15.35, lon: 44.20, title: "Yémen",                           desc: "Conflit Houthis/coalition, Mer Rouge.",         sev: "high",     date: daysAgo(4), tags: ["Yémen"] },
    { lat: 34.55, lon: 69.20, title: "Afghanistan",                     desc: "Insurrection résiduelle et tensions.",         sev: "med",      date: daysAgo(7), tags: ["Afghanistan"] },
    { lat: 4.85,  lon: 31.58, title: "Soudan du Sud",                   desc: "Violences intercommunautaires.",                sev: "med",      date: daysAgo(10), tags: ["Soudan du Sud"] },
    { lat: 12.12, lon: 15.05, title: "Tchad — frontière est",           desc: "Afflux de réfugiés et tensions armées.",       sev: "med",      date: daysAgo(8), tags: ["Tchad"] },
    { lat: 9.08,  lon: 7.54,  title: "Nigeria — Boko Haram",            desc: "Insurrection dans le nord-est.",                sev: "high",     date: daysAgo(6), tags: ["Nigeria"] },
    { lat: -2.50, lon: 28.95, title: "RDC — Nord-Kivu",                 desc: "Groupes armés, M23.",                           sev: "high",     date: daysAgo(5), tags: ["RDC","M23"] },
    { lat: 5.40,  lon: 43.10, title: "Somalie — Al-Shabaab",            desc: "Offensives contre Al-Shabaab.",                 sev: "high",     date: daysAgo(3), tags: ["Somalie"] },
    { lat: 33.33, lon: 44.40, title: "Irak — tensions",                 desc: "Attaques sur bases de la coalition.",           sev: "med",      date: daysAgo(4), tags: ["Irak"] },
    { lat: 21.22, lon: 39.82, title: "Mer Rouge",                       desc: "Attaques sur navires marchands.",               sev: "high",     date: daysAgo(2), tags: ["Houthis","Maritime"] },
    { lat: 42.75, lon: 43.58, title: "Caucase du Nord",                 desc: "Tensions résiduelles.",                         sev: "low",      date: daysAgo(14), tags: ["Russie"] },
    { lat: 23.68, lon: 90.35, title: "Myanmar — guerre civile",         desc: "Junte vs forces de résistance.",                sev: "high",     date: daysAgo(4), tags: ["Myanmar"] },
  ],

  iranAttacks: [
    { lat: 32.08, lon: 34.78, title: "Tel-Aviv — interception", desc: "Missiles balistiques interceptés.", sev: "high",     date: daysAgo(3),  tags: ["Iran","Israël"] },
    { lat: 31.77, lon: 35.21, title: "Jérusalem — sirènes",      desc: "Alertes sirènes suite au lancement.", sev: "high",   date: daysAgo(3),  tags: ["Iran","Israël"] },
    { lat: 25.28, lon: 51.53, title: "Qatar — base Al-Udeid",    desc: "Menaces visant bases US.",           sev: "med",     date: daysAgo(7),  tags: ["Iran","US"] },
    { lat: 26.23, lon: 50.58, title: "Bahreïn — 5ème flotte",    desc: "Alertes élevées.",                   sev: "med",     date: daysAgo(6),  tags: ["Iran"] },
    { lat: 33.31, lon: 44.36, title: "Irak — Ain al-Asad",       desc: "Roquettes vers base coalition.",     sev: "high",    date: daysAgo(5),  tags: ["Iran","Irak"] },
    { lat: 36.20, lon: 37.15, title: "Syrie — attaques drones",  desc: "Drones iraniens visant bases US.",   sev: "high",    date: daysAgo(4),  tags: ["Iran"] },
  ],

  hotspots: [
    { lat: 23.60, lon: 120.95, title: "Taïwan — détroit",                desc: "Incursions aériennes quasi quotidiennes.",    sev: "high",     date: daysAgo(1),  tags: ["Chine","Taïwan"] },
    { lat: 37.55, lon: 127.00, title: "Péninsule coréenne",              desc: "Tirs de missiles balistiques nord-coréens.",  sev: "high",     date: daysAgo(3),  tags: ["Corée"] },
    { lat: 21.00, lon: 115.00, title: "Mer de Chine méridionale",        desc: "Manoeuvres et revendications territoriales.", sev: "high",     date: daysAgo(2),  tags: ["Chine","Philippines"] },
    { lat: 40.15, lon: 44.50,  title: "Arménie/Azerbaïdjan",             desc: "Corridor de Lachin, tensions.",               sev: "med",      date: daysAgo(7),  tags: ["Caucase"] },
    { lat: 35.00, lon: 33.00,  title: "Chypre — ligne verte",            desc: "Statu quo tendu.",                            sev: "low",      date: daysAgo(14), tags: ["Chypre"] },
    { lat: 34.00, lon: 71.00,  title: "Frontière AFG/PAK",               desc: "Incidents transfrontaliers.",                 sev: "med",      date: daysAgo(5),  tags: ["Pakistan"] },
    { lat: 33.90, lon: 35.50,  title: "Liban sud — LAF/UNIFIL",          desc: "Frappes et frictions israéliennes.",          sev: "high",     date: daysAgo(2),  tags: ["Liban"] },
    { lat: -1.50, lon: 36.80,  title: "Corne de l'Afrique",              desc: "Instabilité régionale.",                      sev: "med",      date: daysAgo(8),  tags: ["Afrique"] },
  ],

  // Major military bases (public / well-known)
  bases: [
    { lat: 36.93, lon: -76.03, title: "Norfolk Naval Station",  desc: "Plus grande base navale du monde.",    sev: "low", tags: ["USA","Navy"] },
    { lat: 38.72, lon: -77.14, title: "Pentagone",              desc: "DoD HQ.",                              sev: "low", tags: ["USA"] },
    { lat: 25.28, lon: 51.53, title: "Al Udeid Air Base",       desc: "Quartier général CENTCOM.",            sev: "med", tags: ["USA","Qatar"] },
    { lat: 35.35, lon: 139.35, title: "Yokosuka",               desc: "Base navale US, 7ème flotte.",         sev: "med", tags: ["USA","Japon"] },
    { lat: 26.21, lon: 50.58, title: "NSA Bahreïn",             desc: "5ème flotte US.",                      sev: "med", tags: ["USA"] },
    { lat: 44.80, lon: 20.47, title: "Belgrade — base aérienne",desc: "Base serbe.",                          sev: "low", tags: ["Serbie"] },
    { lat: 54.77, lon: 20.48, title: "Kaliningrad",             desc: "Enclave militaire russe (Iskander).",  sev: "high", tags: ["Russie"] },
    { lat: 40.42, lon: 40.27, title: "İncirlik",                desc: "Base aérienne OTAN (Turquie).",        sev: "med", tags: ["OTAN","Turquie"] },
    { lat: 52.41, lon: 13.52, title: "Ramstein AB",             desc: "Principale base USAF en Europe.",      sev: "med", tags: ["USA","Allemagne"] },
    { lat: 9.54,  lon: 2.08,  title: "Djibouti — Camp Lemonnier",desc: "Présence US/France en Afrique.",      sev: "med", tags: ["Djibouti"] },
    { lat: 36.77, lon: 126.50,title: "Osan AB",                 desc: "Base US en Corée du Sud.",             sev: "med", tags: ["USA","Corée"] },
    { lat: 19.90, lon: 110.00,title: "Hainan — base sous-marine",desc: "Base chinoise de SNLE.",              sev: "high", tags: ["Chine"] },
    { lat: 43.12, lon: 131.88,title: "Vladivostok",             desc: "Flotte du Pacifique russe.",           sev: "high", tags: ["Russie"] },
    { lat: 44.61, lon: 33.53, title: "Sébastopol",              desc: "Flotte de la mer Noire.",              sev: "critical", tags: ["Russie","Ukraine"] },
    { lat: 35.10, lon: 126.80,title: "Gwangju AB",              desc: "Base sud-coréenne.",                   sev: "low", tags: ["Corée du Sud"] },
    { lat: 12.05, lon: 44.03, title: "Aden",                    desc: "Port stratégique Bab-el-Mandeb.",      sev: "high", tags: ["Yémen"] },
    { lat: 28.58, lon: 77.13, title: "Hindon AFS",              desc: "Base aérienne indienne.",              sev: "med", tags: ["Inde"] },
    { lat: 31.64, lon: 65.73, title: "Kandahar AB",             desc: "Base afghane (anciennement US/OTAN).", sev: "low", tags: ["Afghanistan"] },
  ],

  // Known nuclear sites (reactors, enrichment, storage — public)
  nuclear: [
    { lat: 34.39, lon: 50.87, title: "Natanz (Iran)",            desc: "Enrichissement uranium.",         sev: "critical", tags: ["Iran"] },
    { lat: 34.63, lon: 50.99, title: "Fordow (Iran)",            desc: "Enrichissement enterré.",         sev: "critical", tags: ["Iran"] },
    { lat: 35.32, lon: 25.18, title: "Bouchehr NPP",             desc: "Centrale iranienne.",             sev: "high",     tags: ["Iran"] },
    { lat: 51.39, lon: 30.10, title: "Tchernobyl",               desc: "Site contaminé, sarcophage.",     sev: "critical", tags: ["Ukraine"] },
    { lat: 47.51, lon: 34.58, title: "Zaporijjia NPP",           desc: "Plus grande centrale d'Europe.",  sev: "critical", tags: ["Ukraine"] },
    { lat: 40.44, lon: 49.65, title: "Yongbyon",                 desc: "Complexe nord-coréen.",           sev: "critical", tags: ["Corée du Nord"] },
    { lat: 49.42, lon: -117.15,title: "Hanford",                 desc: "Ancien site plutonium US.",       sev: "high",     tags: ["USA"] },
    { lat: 37.42, lon: -122.13,title: "SLAC",                    desc: "Accélérateur (US).",             sev: "low",      tags: ["USA"] },
    { lat: 46.72, lon: 6.78,  title: "CERN",                     desc: "Recherche fondamentale.",         sev: "low",      tags: ["Europe"] },
    { lat: 34.69, lon: 135.19,title: "Fukushima Daiichi",        desc: "Site accidenté (2011).",          sev: "high",     tags: ["Japon"] },
    { lat: 48.15, lon: 11.58, title: "Forschungsreaktor München",desc: "Réacteur de recherche.",          sev: "low",      tags: ["Allemagne"] },
    { lat: 51.50, lon: -0.20, title: "Harwell",                  desc: "Ancien site nucléaire.",          sev: "low",      tags: ["UK"] },
    { lat: 45.29, lon: 5.71,  title: "CEA Grenoble",             desc: "Centre CEA.",                     sev: "low",      tags: ["France"] },
    { lat: 49.65, lon: 6.16,  title: "Cattenom",                 desc: "Centrale française.",             sev: "med",      tags: ["France"] },
    { lat: 43.40, lon: 4.87,  title: "Marcoule",                 desc: "Site nucléaire français.",        sev: "med",      tags: ["France"] },
    { lat: 41.20, lon: -1.40, title: "Ascó",                     desc: "Centrale espagnole.",             sev: "low",      tags: ["Espagne"] },
    { lat: 55.72, lon: 36.85, title: "Obninsk",                  desc: "Premier réacteur civil.",         sev: "low",      tags: ["Russie"] },
    { lat: 33.04, lon: 73.71, title: "Kahuta",                   desc: "Enrichissement pakistanais.",     sev: "critical", tags: ["Pakistan"] },
    { lat: 31.83, lon: 34.80, title: "Dimona",                   desc: "Centre nucléaire israélien.",     sev: "high",     tags: ["Israël"] },
  ],

  gamma: [
    { lat: 43.65, lon: -79.38, title: "Irradiateur médical Toronto", desc: "Source Co-60.", sev: "low", tags: ["Canada"] },
    { lat: 48.85, lon: 2.35,   title: "Saclay irradiateur",           desc: "Recherche.",      sev: "low", tags: ["France"] },
    { lat: 55.75, lon: 37.62,  title: "Moscou — irradiateur",         desc: "Stérilisation.",  sev: "low", tags: ["Russie"] },
  ],

  cosmodromes: [
    { lat: 28.57, lon: -80.65, title: "Cap Canaveral",    desc: "Lancement SpaceX/ULA/NASA.", sev: "low", tags: ["USA"] },
    { lat: 45.92, lon: 63.34,  title: "Baïkonour",        desc: "Cosmodrome russe historique.", sev: "low", tags: ["Russie"] },
    { lat: 62.93, lon: 40.59,  title: "Plessetsk",        desc: "Cosmodrome militaire russe.", sev: "med", tags: ["Russie"] },
    { lat: 5.24,  lon: -52.77, title: "Kourou",           desc: "Centre spatial guyanais.",    sev: "low", tags: ["France","ESA"] },
    { lat: 28.25, lon: 102.03, title: "Xichang",          desc: "Cosmodrome chinois.",         sev: "med", tags: ["Chine"] },
    { lat: 40.96, lon: 100.30, title: "Jiuquan",          desc: "Cosmodrome chinois.",         sev: "med", tags: ["Chine"] },
    { lat: 41.12, lon: 100.30, title: "Wenchang",         desc: "Cosmodrome chinois.",         sev: "med", tags: ["Chine"] },
    { lat: 30.38, lon: 130.97, title: "Tanegashima",      desc: "Cosmodrome JAXA.",            sev: "low", tags: ["Japon"] },
    { lat: 13.73, lon: 80.23,  title: "Sriharikota",      desc: "Cosmodrome ISRO.",            sev: "low", tags: ["Inde"] },
    { lat: 39.66, lon: 124.70, title: "Sohae",            desc: "Site lancement nord-coréen.", sev: "critical", tags: ["Corée du Nord"] },
    { lat: 30.60, lon: -104.78,title: "Van Horn (Blue Origin)", desc: "Site Blue Origin.",     sev: "low", tags: ["USA"] },
    { lat: 25.99, lon: -97.20, title: "Boca Chica (SpaceX)", desc: "Starbase SpaceX.",         sev: "low", tags: ["USA"] },
  ],

  cables: [
    { lat: 40.76, lon: -74.00, title: "Landing NY",       desc: "Hub principal câbles transatlantiques.", sev: "med", tags: ["Infra"] },
    { lat: 50.92, lon: -1.40,  title: "Bude/Southampton", desc: "Atterrissage UK.",                       sev: "med", tags: ["UK"] },
    { lat: 48.85, lon: -3.43,  title: "Saint-Valery",     desc: "Atterrissage France.",                   sev: "med", tags: ["France"] },
    { lat: 1.29,  lon: 103.85, title: "Singapour",         desc: "Hub Asie.",                              sev: "high",tags: ["Asie"] },
    { lat: 35.68, lon: 139.65, title: "Tokyo",             desc: "Hub Pacifique.",                         sev: "high",tags: ["Japon"] },
    { lat: 30.05, lon: 31.24,  title: "Alexandrie",        desc: "Concentration de câbles.",               sev: "high",tags: ["Égypte"] },
    { lat: -33.86,lon: 151.21, title: "Sydney",            desc: "Atterrissage Australie.",                sev: "med", tags: ["Australie"] },
    { lat: 25.26, lon: 55.30,  title: "Dubaï",             desc: "Hub golfe.",                             sev: "high",tags: ["EAU"] },
  ],

  pipelines: [
    { lat: 55.50, lon: 14.80, title: "Nord Stream (dommage)",desc: "Gazoduc saboté 2022.",           sev: "critical",date: daysAgo(900), tags: ["Europe"] },
    { lat: 45.00, lon: 35.00, title: "TurkStream",           desc: "Gaz russe vers Turquie.",         sev: "high",    tags: ["Russie","Turquie"] },
    { lat: 58.50, lon: 75.00, title: "Urengoy–Uzhgorod",     desc: "Grand gazoduc russe.",            sev: "med",     tags: ["Russie"] },
    { lat: 40.24, lon: 49.99, title: "BTC (Bakou-Tbilissi-Ceyhan)",desc:"Pétrole Caspienne.",         sev: "high",    tags: ["Caucase"] },
    { lat: 31.02, lon: 32.55, title: "Suez pipeline (SUMED)",desc:"Contournement Suez.",              sev: "high",    tags: ["Égypte"] },
    { lat: 29.40, lon: 48.10, title: "Ras Tanura",           desc: "Terminal pétrolier saoudien.",    sev: "critical",tags: ["Arabie saoudite"] },
    { lat: 30.25, lon: 48.87, title: "Bassora",              desc: "Exportations pétrolières irakiennes.",sev:"high", tags: ["Irak"] },
    { lat: 61.20, lon: 73.40, title: "Siberie — West Siberia",desc:"Hub gazier.",                     sev: "med",     tags: ["Russie"] },
  ],

  datacenters: [
    { lat: 39.08, lon: -77.45, title: "Ashburn (VA)",     desc: "Cluster datacenter mondial.",   sev: "high", tags: ["USA"] },
    { lat: 53.33, lon: -6.26,  title: "Dublin",            desc: "Cluster IA Europe.",            sev: "high", tags: ["Irlande"] },
    { lat: 37.38, lon: -122.08,title: "Santa Clara",       desc: "Silicon Valley.",               sev: "high", tags: ["USA"] },
    { lat: 47.60, lon: -122.33,title: "Seattle / Azure",   desc: "Hub Microsoft.",                sev: "high", tags: ["USA"] },
    { lat: 1.29,  lon: 103.85, title: "Singapour",          desc: "Hub APAC.",                     sev: "high", tags: ["Asie"] },
    { lat: -33.86,lon: 151.21, title: "Sydney",             desc: "Cluster ANZ.",                  sev: "med",  tags: ["Australie"] },
    { lat: 50.11, lon: 8.68,   title: "Francfort",          desc: "Hub DE-CIX.",                   sev: "high", tags: ["Allemagne"] },
    { lat: 48.85, lon: 2.35,   title: "Paris",              desc: "Cluster PAR.",                  sev: "med",  tags: ["France"] },
  ],

  military: [
    { lat: 54.77, lon: 20.48, title: "Kaliningrad — exercice",  desc: "Manoeuvres russes.",           sev: "high",  date: daysAgo(2), tags: ["Russie"] },
    { lat: 35.00, lon: 120.00,title: "PLA Navy — exercice",     desc: "Exercices maritimes Chine.",   sev: "high",  date: daysAgo(3), tags: ["Chine"] },
    { lat: 52.41, lon: 13.52, title: "OTAN — exercice",         desc: "Defender Europe.",             sev: "med",   date: daysAgo(5), tags: ["OTAN"] },
    { lat: 34.00, lon: 38.00, title: "Frappes aériennes",       desc: "Frappes signalées en Syrie.",  sev: "high",  date: daysAgo(1), tags: ["Syrie"] },
    { lat: 50.45, lon: 30.52, title: "Mouvements UAF",          desc: "Rotations de brigades.",       sev: "med",   date: daysAgo(2), tags: ["Ukraine"] },
    { lat: 38.88, lon: 127.80,title: "Corée Nord — tir missile",desc:"Tir de missile balistique.",    sev: "high",  date: daysAgo(4), tags: ["Corée du Nord"] },
  ],

  shipping: [
    { lat: 12.05, lon: 44.03, title: "Bab-el-Mandeb",  desc: "Passage maritime critique.",      sev: "critical", tags: ["Maritime"] },
    { lat: 26.58, lon: 56.25, title: "Détroit d'Hormuz",desc: "20% du pétrole mondial.",         sev: "critical", tags: ["Maritime"] },
    { lat: 30.00, lon: 32.55, title: "Canal de Suez",   desc: "Artère Europe-Asie.",             sev: "critical", tags: ["Maritime"] },
    { lat: 2.50,  lon: 102.00,title: "Détroit de Malacca",desc: "Un tiers du commerce mondial.", sev: "critical", tags: ["Maritime"] },
    { lat: 9.05,  lon: -79.67,title: "Canal de Panama", desc: "Artère Atlantique-Pacifique.",    sev: "high",     tags: ["Maritime"] },
    { lat: 41.00, lon: 29.00, title: "Bosphore",        desc: "Mer Noire - Méditerranée.",       sev: "critical", tags: ["Maritime"] },
    { lat: 35.95, lon: -5.60, title: "Détroit de Gibraltar",desc:"Atlantique - Méditerranée.", sev: "high",     tags: ["Maritime"] },
  ],

  trade: [
    { lat: 31.23, lon: 121.47, title: "Port de Shanghai",  desc: "Plus grand port mondial.",    sev: "med", tags: ["Chine"] },
    { lat: 22.29, lon: 114.17, title: "Hong Kong",          desc: "Hub commercial.",             sev: "med", tags: ["Chine"] },
    { lat: 1.29,  lon: 103.85, title: "Singapour",          desc: "Principal hub Asie SE.",      sev: "med", tags: ["Asie"] },
    { lat: 51.95, lon: 4.13,   title: "Rotterdam",          desc: "Premier port européen.",      sev: "med", tags: ["Europe"] },
    { lat: 33.74, lon: -118.27,title: "Los Angeles",        desc: "Premier port US.",            sev: "med", tags: ["USA"] },
  ],

  flights: [],
  protests: [],
  displacement: [],
  climate: [],

  outages: [
    { lat: 32.17, lon: -7.17, title: "Maroc — coupure internet",desc: "Panne partielle.",       sev: "med",  date: daysAgo(2), tags: ["Afrique"] },
    { lat: 30.00, lon: 31.25, title: "Égypte — ralentissement", desc: "Câble sous-marin affecté.",sev:"high", date: daysAgo(4), tags: ["Afrique"] },
    { lat: 43.50, lon: 41.50, title: "Caucase — dégradation",   desc: "Panne régionale.",       sev: "med",  date: daysAgo(1), tags: ["Caucase"] },
  ],

  cyberThreats: [
    { lat: 38.90, lon: -77.04, title: "CISA alerte — APT29",  desc: "Activité d'acteur étatique signalée.", sev: "high", date: daysAgo(1), tags: ["APT","USA"] },
    { lat: 55.75, lon: 37.62,  title: "Ransomware — source",   desc: "Campagne active depuis la Russie.",    sev: "high", date: daysAgo(2), tags: ["Ransomware"] },
    { lat: 39.90, lon: 116.40, title: "APT41 — activité",      desc: "Intrusion ciblant secteur télécoms.",  sev: "med",  date: daysAgo(3), tags: ["Chine"] },
    { lat: 52.52, lon: 13.40,  title: "DE — infrastructure",    desc: "Incident critique infrastructure.",     sev: "med",  date: daysAgo(1), tags: ["Europe"] },
    { lat: 31.77, lon: 35.21,  title: "Israël — intrusion",     desc: "Campagne de phishing ciblée.",          sev: "med",  date: daysAgo(3), tags: ["MENA"] },
  ],

  waterways: [
    { lat: 12.05, lon: 44.03, title: "Bab-el-Mandeb",  desc: "Corne de l'Afrique / Mer Rouge.",   sev: "critical", tags: ["Maritime"] },
    { lat: 26.58, lon: 56.25, title: "Hormuz",          desc: "Sortie du Golfe persique.",         sev: "critical", tags: ["Maritime"] },
    { lat: 30.00, lon: 32.55, title: "Suez",            desc: "Canal de Suez.",                    sev: "critical", tags: ["Maritime"] },
    { lat: 2.50,  lon: 102.00,title: "Malacca",         desc: "Malacca.",                          sev: "critical", tags: ["Maritime"] },
    { lat: 9.05,  lon: -79.67,title: "Panama",          desc: "Canal de Panama.",                  sev: "high",     tags: ["Maritime"] },
    { lat: 41.00, lon: 29.00, title: "Bosphore",        desc: "Bosphore.",                         sev: "critical", tags: ["Maritime"] },
    { lat: 35.95, lon: -5.60, title: "Gibraltar",       desc: "Gibraltar.",                        sev: "high",     tags: ["Maritime"] },
    { lat: 55.58, lon: 11.00, title: "Öresund",         desc: "Baltique - Mer du Nord.",           sev: "med",      tags: ["Maritime"] },
  ],

  economic: [
    { lat: 40.71, lon: -74.01, title: "NYSE",          desc: "Bourse de New York.",        sev: "low", tags: ["Finance"] },
    { lat: 51.50, lon: -0.12,  title: "City of London",desc: "Hub financier.",             sev: "low", tags: ["UK"] },
    { lat: 35.68, lon: 139.65, title: "Tokyo",          desc: "Bourse de Tokyo.",          sev: "low", tags: ["Japon"] },
    { lat: 22.29, lon: 114.17, title: "Hong Kong",      desc: "HKEX.",                     sev: "low", tags: ["Chine"] },
    { lat: 31.23, lon: 121.47, title: "Shanghai",       desc: "SSE.",                      sev: "low", tags: ["Chine"] },
    { lat: 1.29,  lon: 103.85, title: "Singapour",       desc: "Centre financier SE.",     sev: "low", tags: ["Asie"] },
    { lat: 50.11, lon: 8.68,   title: "Francfort",       desc: "BCE + DAX.",               sev: "low", tags: ["Europe"] },
    { lat: 47.37, lon: 8.54,   title: "Zurich",          desc: "Hub bancaire.",             sev: "low", tags: ["Suisse"] },
  ],

  minerals: [
    { lat: -5.00, lon: 25.00, title: "RDC — Cobalt",      desc: "70% cobalt mondial.",            sev: "high", tags: ["Afrique"] },
    { lat: 38.00, lon: 100.00,title: "Chine — Terres rares",desc:"80% raffinage mondial.",        sev: "high", tags: ["Chine"] },
    { lat: -23.50,lon: -46.60,title: "Brésil — Niobium",   desc:"Réserves majeures.",             sev: "med",  tags: ["LATAM"] },
    { lat: -30.00,lon: -70.00,title: "Chili — Cuivre/Lithium",desc:"Premier exportateur cuivre.",sev:"high",  tags: ["LATAM"] },
    { lat: -26.00,lon: 28.00, title: "RSA — PGM",         desc:"Platine.",                        sev: "med",  tags: ["Afrique"] },
    { lat: 44.80, lon: 23.00, title: "Ukraine — Titane",  desc:"Ressources critiques.",           sev: "high", tags: ["Europe"] },
  ],

  gps: [
    { lat: 54.77, lon: 20.48, title: "Baltique — brouillage",desc: "Brouillage GPS signalé.",  sev: "high", date: daysAgo(1), tags: ["GPS"] },
    { lat: 36.20, lon: 36.15, title: "Méditerranée est",     desc: "Perturbations signalées.",  sev: "med",  date: daysAgo(2), tags: ["GPS"] },
    { lat: 31.77, lon: 35.21, title: "Levant — jamming",     desc: "Interférences GNSS.",       sev: "high", date: daysAgo(1), tags: ["GPS"] },
    { lat: 26.58, lon: 56.25, title: "Hormuz — jamming",     desc: "Interférences maritimes.",  sev: "high", date: daysAgo(3), tags: ["GPS"] },
    { lat: 44.43, lon: 26.10, title: "Mer Noire",            desc: "Spoofing signalé.",         sev: "med",  date: daysAgo(2), tags: ["GPS"] },
  ],

  orbital: [
    { lat: 0, lon: 0, title: "Starlink — orbites basses",     desc: "Constellation 6k+ satellites.", sev: "low",  tags: ["Orbital"] },
    { lat: 0, lon: 0, title: "OneWeb",                        desc: "Constellation LEO.",            sev: "low",  tags: ["Orbital"] },
    { lat: 0, lon: 20, title: "Surveillance russe",            desc: "Satellites Kosmos.",            sev: "high", tags: ["Russie"] },
    { lat: 0, lon: 110,title: "China SAT — surveillance",      desc: "Yaogan/Tianhui.",               sev: "high", tags: ["Chine"] },
  ],

  instability: [
    { lat: -18.00, lon: 47.50, title: "Madagascar",  desc: "Instabilité politique.",   sev: "med",  tags: ["Afrique"] },
    { lat: 13.00, lon: -15.00, title: "Sahel",        desc: "Coups d'état en série.",   sev: "high", tags: ["Afrique"] },
    { lat: 10.50, lon: -66.90, title: "Venezuela",    desc: "Crise socio-économique.",  sev: "high", tags: ["LATAM"] },
    { lat: 14.60, lon: -90.50, title: "Guatemala",    desc: "Instabilité institutionnelle.",sev: "med", tags: ["LATAM"] },
    { lat: 18.58, lon: -72.34, title: "Haïti",        desc: "Violence des gangs.",      sev: "critical", tags: ["LATAM"] },
    { lat: 24.85, lon: 67.00,  title: "Pakistan",     desc: "Instabilité et terrorisme.",sev:"high", tags: ["Asie"] },
    { lat: 13.00, lon: 2.11,   title: "Niger",        desc: "Coup d'État 2023.",        sev: "high", tags: ["Afrique"] },
    { lat: 12.65, lon: -7.99,  title: "Mali",         desc: "Junte + retrait de la MINUSMA.",sev:"high", tags: ["Afrique"] },
  ],

  sanctions: [
    { lat: 55.75, lon: 37.62,  title: "Russie",        desc: "Sanctions massives (UE/US/UK).",         sev: "critical", tags: ["Sanctions"] },
    { lat: 32.42, lon: 53.69,  title: "Iran",          desc: "Sanctions US/UE multi-décennies.",        sev: "critical", tags: ["Sanctions"] },
    { lat: 40.00, lon: 127.00, title: "Corée du Nord", desc: "Sanctions ONU.",                          sev: "critical", tags: ["Sanctions"] },
    { lat: 33.51, lon: 36.29,  title: "Syrie",         desc: "Caesar Act, UE.",                         sev: "critical", tags: ["Sanctions"] },
    { lat: 21.52, lon: -77.78, title: "Cuba",          desc: "Embargo US.",                             sev: "high",     tags: ["Sanctions"] },
    { lat: 10.50, lon: -66.90, title: "Venezuela",     desc: "Sanctions sectorielles US.",             sev: "high",      tags: ["Sanctions"] },
    { lat: 22.00, lon: 98.00,  title: "Myanmar",       desc: "Sanctions post-coup.",                    sev: "high",     tags: ["Sanctions"] },
    { lat: 15.55, lon: 32.53,  title: "Soudan",        desc: "Sanctions ciblées.",                      sev: "high",     tags: ["Sanctions"] },
  ],

  webcams: [
    { lat: 40.75, lon: -73.98, title: "Times Square cam", desc: "Webcam publique.", sev: "low", tags: ["USA"] },
    { lat: 48.85, lon: 2.29,   title: "Tour Eiffel cam",   desc: "Webcam publique.", sev: "low", tags: ["France"] },
    { lat: 35.66, lon: 139.70, title: "Shibuya cam",        desc: "Webcam publique.", sev: "low", tags: ["Japon"] },
    { lat: 51.51, lon: -0.12,  title: "London Westminster", desc: "Webcam publique.", sev: "low", tags: ["UK"] },
  ],

  disease: [
    { lat: -4.00, lon: 21.00, title: "RDC — Mpox",          desc: "Foyer épidémique actif.", sev: "high",  date: daysAgo(10), tags: ["Santé"] },
    { lat: 20.59, lon: 78.96, title: "Inde — dengue",       desc: "Saison d'épidémie.",       sev: "med",   date: daysAgo(15), tags: ["Santé"] },
    { lat: 9.00,  lon: 8.00,  title: "Nigeria — choléra",    desc: "Flambée signalée.",        sev: "med",   date: daysAgo(12), tags: ["Santé"] },
    { lat: -15.00,lon: 30.00, title: "Malawi — choléra",     desc: "Épidémie.",                sev: "med",   date: daysAgo(18), tags: ["Santé"] },
  ],

  radiation: [],
};

// ---------- LIVE FETCHERS ----------
WM.liveFeeds = {
  // GDELT 2.0 DOC API — real-time global news. Uses CORS proxy if direct call blocked.
  async gdelt(queryKeywords = "conflict OR war OR attack OR sanctions OR cyber", maxRecords = 25) {
    const q = encodeURIComponent(queryKeywords);
    const base = `https://api.gdeltproject.org/api/v2/doc/doc?query=${q}&mode=artlist&maxrecords=${maxRecords}&format=json&sort=datedesc&timespan=24h`;
    const attempts = [
      base,
      "https://corsproxy.io/?" + encodeURIComponent(base),
      "https://api.allorigins.win/raw?url=" + encodeURIComponent(base),
    ];
    for (const url of attempts) {
      try {
        const r = await fetch(url);
        if (!r.ok) continue;
        const txt = await r.text();
        // Validate — GDELT sometimes returns plain-text errors ("Queries containing…")
        if (!txt.trim().startsWith("{")) continue;
        let j;
        try { j = JSON.parse(txt); } catch { continue; }
        if (!j.articles) continue;
        return j.articles.map(a => ({
          title: a.title,
          url: a.url,
          source: a.domain,
          country: a.sourcecountry,
          seendate: a.seendate,
          language: a.language,
          tone: a.tone,
        }));
      } catch (e) { /* try next */ }
    }
    console.warn("GDELT: all attempts failed");
    return [];
  },

  // CoinGecko — real crypto prices + 24h change (no auth)
  async crypto() {
    try {
      const ids = "bitcoin,ethereum,binancecoin,solana,ripple";
      const url = `https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=usd&include_24hr_change=true`;
      const r = await fetch(url);
      if (!r.ok) return [];
      const j = await r.json();
      const map = { bitcoin: "BTC", ethereum: "ETH", binancecoin: "BNB", solana: "SOL", ripple: "XRP" };
      return Object.entries(j).map(([k, v]) => ({
        ticker: map[k] || k.toUpperCase(),
        price: v.usd,
        delta: v.usd_24h_change || 0,
        desc: "Crypto — 24h",
      }));
    } catch (e) { console.warn("CoinGecko failed", e); return []; }
  },

  // Frankfurter.app — FX live + historique (gratuit, no auth, CORS OK, BCE comme source)
  async forex() {
    try {
      const today = new Date().toISOString().slice(0, 10);
      const yesterday = new Date(Date.now() - 86400e3).toISOString().slice(0, 10);
      const [tR, yR] = await Promise.all([
        fetch(`https://api.frankfurter.app/latest?from=USD`),
        fetch(`https://api.frankfurter.app/${yesterday}?from=USD`),
      ]);
      if (!tR.ok || !yR.ok) return [];
      const t = await tR.json(), y = await yR.json();
      const pairs = [
        { ticker: "EUR/USD", inv: true,  cur: "EUR", desc: "Euro / Dollar" },
        { ticker: "GBP/USD", inv: true,  cur: "GBP", desc: "Livre / Dollar" },
        { ticker: "USD/JPY", inv: false, cur: "JPY", desc: "Dollar / Yen" },
        { ticker: "USD/CNY", inv: false, cur: "CNY", desc: "Dollar / Yuan" },
        { ticker: "USD/CHF", inv: false, cur: "CHF", desc: "Dollar / Franc CH" },
      ];
      return pairs.map(p => {
        const tr = t.rates?.[p.cur], yr = y.rates?.[p.cur];
        if (tr == null || yr == null) return null;
        const tp = p.inv ? 1/tr : tr;
        const yp = p.inv ? 1/yr : yr;
        const delta = ((tp - yp) / yp) * 100;
        return { ticker: p.ticker, price: tp.toFixed(4), delta, desc: p.desc };
      }).filter(Boolean);
    } catch (e) { console.warn("Frankfurter forex failed", e); return []; }
  },

  // METAR (NOAA aviationweather.gov) — météo aéroports → score perturbation
  async airportMetar(icaoList) {
    const ids = icaoList.join(",");
    const arr = await this._corsFetchJson(`https://aviationweather.gov/api/data/metar?ids=${ids}&format=json`);
    if (!Array.isArray(arr)) return [];
    try {
      return arr.map(m => {
        const wind = m.wspd || 0;        // nœuds
        const gust = m.wgst || 0;
        const visi = m.visib;             // miles
        const visiNum = typeof visi === "string" ? parseFloat(visi) : visi;
        const wxCode = (m.wxString || "").toLowerCase();
        const hasStorm = /\bts|tsra|fc|sq/i.test(m.rawOb || "");
        const hasSnow = /\bsn|sg|pl/i.test(m.rawOb || "");
        const hasFog = /\bfg|br/i.test(m.rawOb || "");
        let status = "NORMALE", delay = "—";
        if (hasStorm || gust > 35 || (visiNum != null && visiNum < 1)) { status = "GRAVE"; delay = "Forte perturbation"; }
        else if (hasSnow || gust > 25 || (visiNum != null && visiNum < 3)) { status = "MODÉRÉE"; delay = "Risque de retard"; }
        else if (hasFog || wind > 20 || (visiNum != null && visiNum < 5)) { status = "MINEURE"; delay = "Surveillance"; }
        return { code: m.icaoId, status, delay, wind, visi: visiNum, raw: m.rawOb };
      });
    } catch (e) { console.warn("METAR failed", e); return []; }
  },

  // ReliefWeb — humanitarian updates (country instability signals)
  async reliefweb() {
    try {
      const url = "https://api.reliefweb.int/v1/reports?appname=argos&limit=20&sort[]=date:desc&preset=latest&profile=list";
      const r = await fetch(url);
      if (!r.ok) return [];
      const j = await r.json();
      return (j.data || []).map(d => ({
        title: d.fields?.title || "",
        url: d.fields?.url || "",
        date: d.fields?.date?.created || "",
        country: (d.fields?.primary_country?.name) || "",
        source: (d.fields?.source && d.fields.source[0]?.name) || "ReliefWeb",
      }));
    } catch (e) { console.warn("ReliefWeb failed", e); return []; }
  },

  // Multi-city weather + severe weather detection (Open-Meteo, no auth, CORS-OK)
  async multiWeather(cities) {
    const lats = cities.map(c => c.lat).join(",");
    const lons = cities.map(c => c.lon).join(",");
    try {
      const url = `https://api.open-meteo.com/v1/forecast?latitude=${lats}&longitude=${lons}&current=temperature_2m,apparent_temperature,weather_code,wind_speed_10m,wind_gusts_10m,precipitation,uv_index&timezone=UTC`;
      const r = await fetch(url);
      if (!r.ok) return [];
      const data = await r.json();
      const arr = Array.isArray(data) ? data : [data];
      return arr.map((d, i) => {
        const c = d.current || {};
        const wc = c.weather_code;
        const severe = (c.wind_speed_10m > 50) || (c.wind_gusts_10m > 80) || (c.precipitation > 15) || (wc >= 95) || (c.temperature_2m < -20) || (c.temperature_2m > 42);
        return {
          ...cities[i],
          temp: c.temperature_2m,
          feels: c.apparent_temperature,
          wind: c.wind_speed_10m,
          gusts: c.wind_gusts_10m,
          rain: c.precipitation,
          uv: c.uv_index,
          code: wc,
          severe,
          severeReason: severe ? (wc >= 95 ? "Orage violent" : c.wind_speed_10m > 50 ? "Vent fort" : c.precipitation > 15 ? "Précipitations intenses" : c.temperature_2m < -20 ? "Froid extrême" : c.temperature_2m > 42 ? "Canicule" : "Alerte") : null,
        };
      });
    } catch (e) { console.warn("Open-Meteo multi failed", e); return []; }
  },

  // Yahoo Finance helper — chart v8 (no auth) via CORS proxy, parallel par symbole
  async _yahooQuotes(symbols) {
    const fetchOne = async (sym) => {
      const base = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(sym)}?range=2d&interval=1d`;
      const attempts = [
        "https://corsproxy.io/?" + encodeURIComponent(base),
        "https://api.allorigins.win/raw?url=" + encodeURIComponent(base),
      ];
      for (const url of attempts) {
        try {
          const r = await fetch(url);
          if (!r.ok) continue;
          const j = await r.json();
          const res = j?.chart?.result?.[0];
          if (!res) continue;
          const meta = res.meta || {};
          const price = meta.regularMarketPrice;
          const prev = meta.chartPreviousClose || meta.previousClose;
          if (price == null) continue;
          const delta = prev ? ((price - prev) / prev) * 100 : 0;
          return { symbol: sym, regularMarketPrice: price, regularMarketChangePercent: delta, fullExchangeName: meta.exchangeName };
        } catch {}
      }
      return null;
    };
    const results = await Promise.all(symbols.map(fetchOne));
    return results.filter(Boolean);
  },

  // CORS proxy fallback générique
  async _corsFetchJson(url) {
    const attempts = [
      url,
      "https://corsproxy.io/?" + encodeURIComponent(url),
      "https://api.allorigins.win/raw?url=" + encodeURIComponent(url),
    ];
    for (const u of attempts) {
      try {
        const r = await fetch(u);
        if (!r.ok) continue;
        return await r.json();
      } catch {}
    }
    return null;
  },

  // Commodities — METAUX via gold-api, ÉNERGIE via Yahoo Finance live
  async commodities(category = "metals") {
    if (category === "metals") {
      const r = await fetch("https://api.gold-api.com/price/XAU").catch(()=>null);
      const gold = r?.ok ? (await r.json()).price : null;
      const silverR = await fetch("https://api.gold-api.com/price/XAG").catch(()=>null);
      const silver = silverR?.ok ? (await silverR.json()).price : null;
      // Reste via Yahoo (HG=F cuivre, PL=F platine, PA=F palladium)
      const yahoo = await this._yahooQuotes(["HG=F","PL=F","PA=F"]);
      const get = sym => yahoo.find(q => q.symbol === sym);
      const cu = get("HG=F"), pt = get("PL=F"), pd = get("PA=F");
      return [
        { ticker:"OR",       price: gold || "—",   unit:"$/oz", delta: 0, desc:"Once troy" },
        { ticker:"ARGENT",   price: silver || "—", unit:"$/oz", delta: 0, desc:"Once troy" },
        { ticker:"CUIVRE",   price: cu?.regularMarketPrice ?? "—", unit:"$/lb", delta: cu?.regularMarketChangePercent ?? 0, desc:"Comex" },
        { ticker:"PLATINE",  price: pt?.regularMarketPrice ?? "—", unit:"$/oz", delta: pt?.regularMarketChangePercent ?? 0, desc:"NYMEX" },
        { ticker:"PALLADIUM",price: pd?.regularMarketPrice ?? "—", unit:"$/oz", delta: pd?.regularMarketChangePercent ?? 0, desc:"NYMEX" },
      ].filter(c => c.price !== "—");
    }
    if (category === "energy") {
      // Yahoo : CL=F (WTI), BZ=F (Brent), NG=F (Natural Gas), HO=F (Heating oil)
      const items = await this._yahooQuotes(["BZ=F","CL=F","NG=F","HO=F","RB=F"]);
      const get = sym => items.find(q => q.symbol === sym);
      const map = [
        { sym:"BZ=F", ticker:"BRENT",  unit:"$/bbl",   desc:"Pétrole brut" },
        { sym:"CL=F", ticker:"WTI",    unit:"$/bbl",   desc:"West Texas" },
        { sym:"NG=F", ticker:"GAZ NAT",unit:"$/MMBtu", desc:"Henry Hub" },
        { sym:"HO=F", ticker:"FIOUL",  unit:"$/gal",   desc:"NY Harbor" },
        { sym:"RB=F", ticker:"ESSENCE",unit:"$/gal",   desc:"RBOB" },
      ];
      return map.map(m => {
        const q = get(m.sym);
        return q ? { ticker: m.ticker, price: q.regularMarketPrice, unit: m.unit, delta: q.regularMarketChangePercent || 0, desc: m.desc } : null;
      }).filter(Boolean);
    }
    // FX
    return await this.forex();
  },

  // Indices boursiers majeurs (live Yahoo)
  async stocks() {
    const items = await this._yahooQuotes(["^GSPC","^IXIC","^DJI","^FTSE","^N225","^STOXX50E","^HSI","^FCHI"]);
    const labels = {
      "^GSPC":"S&P 500", "^IXIC":"NASDAQ", "^DJI":"DOW JONES",
      "^FTSE":"FTSE 100", "^N225":"NIKKEI 225", "^STOXX50E":"EURO STOXX 50",
      "^HSI":"HANG SENG", "^FCHI":"CAC 40",
    };
    return items.map(q => ({
      ticker: labels[q.symbol] || q.symbol,
      price: q.regularMarketPrice,
      delta: q.regularMarketChangePercent || 0,
      desc: q.fullExchangeName || "",
    })).filter(s => s.price);
  },

  // CVE activement exploitées — NVD API (NIST, CORS OK), filtre KEV (CISA)
  async cisaKEV() {
    try {
      // 1) total
      const head = await fetch("https://services.nvd.nist.gov/rest/json/cves/2.0?hasKev&resultsPerPage=1");
      if (!head.ok) return [];
      const total = (await head.json()).totalResults || 0;
      const startIndex = Math.max(0, total - 40);
      // 2) dernières entrées
      const r = await fetch(`https://services.nvd.nist.gov/rest/json/cves/2.0?hasKev&resultsPerPage=40&startIndex=${startIndex}`);
      if (!r.ok) return [];
      const j = await r.json();
      const items = (j.vulnerabilities || []).map(x => x.cve);
      items.sort((a, b) => new Date(b.cisaExploitAdd || 0) - new Date(a.cisaExploitAdd || 0));
      return items.slice(0, 30).map(v => ({
        cve: v.id,
        name: v.cisaVulnerabilityName || v.descriptions?.find(d=>d.lang==="en")?.value?.slice(0, 100) || "",
        vendor: "",
        product: v.cisaRequiredAction ? "Action requise CISA" : "",
        date: v.cisaExploitAdd ? v.cisaExploitAdd.slice(0, 10) : "",
        ransomware: false,
      }));
    } catch (e) { console.warn("NVD KEV failed", e); return []; }
  },

  // Polymarket public API — prediction markets (avec proxy CORS fallback)
  async polymarket() {
    const base = "https://gamma-api.polymarket.com/markets?limit=10&active=true&closed=false&order=volume&ascending=false";
    const attempts = [
      base,
      "https://corsproxy.io/?" + encodeURIComponent(base),
      "https://api.allorigins.win/raw?url=" + encodeURIComponent(base),
    ];
    for (const url of attempts) {
      try {
        const r = await fetch(url);
        if (!r.ok) continue;
        const arr = await r.json();
        if (!Array.isArray(arr)) continue;
        return arr.slice(0, 10).map(m => ({
          question: m.question,
          outcomes: (m.outcomePrices && JSON.parse(m.outcomePrices)) || [],
          volume: +m.volume || 0,
          endDate: m.endDate,
          slug: m.slug,
          url: "https://polymarket.com/market/" + m.slug,
        }));
      } catch (e) { /* try next */ }
    }
    console.warn("Polymarket: all attempts failed");
    return [];
  },

  // USGS quakes M4.5+ semaine (~80-150 entrées) avec fallback significatifs
  async usgsSignificant() {
    const urls = [
      "https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/4.5_week.geojson",
      "https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/significant_week.geojson",
      "https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_day.geojson",
    ];
    for (const url of urls) {
      try {
        const r = await fetch(url);
        if (!r.ok) continue;
        const j = await r.json();
        const items = (j.features || []).map(f => ({
          title: f.properties.title,
          mag: f.properties.mag,
          place: f.properties.place,
          date: new Date(f.properties.time).toISOString(),
          url: f.properties.url,
        }));
        if (items.length) return items.sort((a,b) => b.mag - a.mag);
      } catch (e) {}
    }
    return [];
  },
};

WM.fetchers = {
  async natural(range) {
    try {
      const r = await fetch("https://eonet.gsfc.nasa.gov/api/v3/events?status=open&limit=200");
      if (!r.ok) throw 0;
      const j = await r.json();
      return (j.events || []).map(e => {
        const g = e.geometry && e.geometry[e.geometry.length - 1];
        if (!g || !g.coordinates) return null;
        const [lon, lat] = g.coordinates;
        return {
          id: e.id,
          lat, lon,
          title: e.title,
          desc: e.description || (e.categories && e.categories[0] && e.categories[0].title) || "",
          sev: (e.categories && e.categories[0] && /volcano|severe/i.test(e.categories[0].title)) ? "high" : "med",
          date: g.date,
          tags: (e.categories || []).map(c => c.title),
          url: e.sources && e.sources[0] && e.sources[0].url,
        };
      }).filter(Boolean);
    } catch (e) { return null; }
  },

  async earthquakes(range) {
    const period = range === "24h" ? "day" : (range === "1h" ? "hour" : "week");
    try {
      const r = await fetch(`https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/significant_${period}.geojson`);
      if (!r.ok) throw 0;
      const j = await r.json();
      return (j.features || []).map(f => ({
        id: f.id,
        lat: f.geometry.coordinates[1], lon: f.geometry.coordinates[0],
        title: f.properties.title,
        desc: `Magnitude ${f.properties.mag} — ${f.properties.place}`,
        sev: f.properties.mag >= 6 ? "critical" : f.properties.mag >= 5 ? "high" : "med",
        date: new Date(f.properties.time).toISOString(),
        tags: ["Séisme", "M" + f.properties.mag],
        url: f.properties.url,
      }));
    } catch (e) { return null; }
  },

  async fires(range) {
    // NASA FIRMS requires a key for real fetch. Use USGS volcanoes as proxy
    // via EONET category:wildfires
    try {
      const r = await fetch("https://eonet.gsfc.nasa.gov/api/v3/categories/wildfires?status=open&limit=120");
      if (!r.ok) throw 0;
      const j = await r.json();
      return (j.events || []).map(e => {
        const g = e.geometry && e.geometry[e.geometry.length - 1];
        if (!g) return null;
        const [lon, lat] = g.coordinates;
        return {
          id: e.id, lat, lon, title: e.title,
          desc: "Incendie actif détecté par satellite.",
          sev: "high", date: g.date, tags: ["Incendie"],
          url: e.sources && e.sources[0] && e.sources[0].url,
        };
      }).filter(Boolean);
    } catch (e) { return null; }
  },

  async weather(range) {
    // Open-Meteo severe weather — pick pinpoints for major cities; easier to show via static + alerts
    const cities = [
      [40.7, -74.0, "New York"], [34.0, -118.2, "Los Angeles"],
      [51.5, -0.1, "London"], [48.85, 2.35, "Paris"], [35.68, 139.65, "Tokyo"],
      [-33.86, 151.21, "Sydney"], [-23.5, -46.6, "São Paulo"], [28.6, 77.2, "Delhi"],
      [30.0, 31.2, "Le Caire"], [19.4, -99.1, "Mexico"], [1.3, 103.8, "Singapour"],
      [55.75, 37.62, "Moscou"], [52.5, 13.4, "Berlin"], [41.0, 28.9, "Istanbul"],
      [25.2, 55.3, "Dubaï"], [6.5, 3.4, "Lagos"], [-26.2, 28.0, "Johannesburg"],
      [14.6, -90.5, "Guatemala"], [-33.4, -70.6, "Santiago"], [35.7, 51.4, "Téhéran"],
    ];
    try {
      const out = [];
      const chunks = cities.slice(0, 12);
      for (const [lat, lon, name] of chunks) {
        try {
          const r = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,weather_code,wind_speed_10m,precipitation&timezone=UTC`);
          if (!r.ok) continue;
          const j = await r.json();
          const c = j.current || {};
          const severe = (c.wind_speed_10m > 60) || (c.precipitation > 20) || (c.weather_code >= 95);
          if (severe || Math.random() < 0.6) {
            out.push({
              id: "wx-" + name, lat, lon,
              title: `${name} — météo`,
              desc: `${c.temperature_2m ?? "?"}°C · vent ${c.wind_speed_10m ?? "?"}km/h · précip. ${c.precipitation ?? 0}mm`,
              sev: severe ? "high" : "low",
              date: new Date().toISOString(),
              tags: ["Météo"],
            });
          }
        } catch (e) {}
      }
      return out;
    } catch (e) { return null; }
  },
};

function daysAgo(n) { return new Date(Date.now() - n*86400000).toISOString(); }

WM.daysAgo = daysAgo;
