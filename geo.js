// Simple geography quiz using Leaflet + Nominatim reverse geocoding
(function(){
    const map = L.map('map', { worldCopyJump: true }).setView([20, 0], 2);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '© OpenStreetMap contributors'
    }).addTo(map);

    const hud = document.getElementById('hud');
    const input = document.getElementById('countryInput');
    const checkBtn = document.getElementById('checkBtn');
    const skipBtn = document.getElementById('skipBtn');
    const feedback = document.getElementById('feedback');
    const correctEl = document.getElementById('correct');
    const wrongEl = document.getElementById('wrong');

    let currentCountry = null;
    let correct = 0, wrong = 0;
    let lastMarker = null; // persistent marker for clicked location

    function normalizeText(s){
        if(!s) return '';
        return s.toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '').replace(/[^a-z\s]/g,'').trim();
    }

    function showHUD(){ hud.classList.remove('hidden'); input.focus(); }
    function hideHUD(){ hud.classList.add('hidden'); }

    function setFeedback(text, ok){
        feedback.textContent = text;
        feedback.style.color = ok ? '#16a34a' : '#dc2626';
    }

    async function onMapClick(e){
        setFeedback('Lade Land...', true);
        showHUD();
        input.value = '';
        currentCountry = null;
        // place or move persistent marker so user sees the selected point even when zooming
        if(lastMarker){
            lastMarker.setLatLng(e.latlng);
        } else {
            lastMarker = L.marker(e.latlng, {riseOnHover:true}).addTo(map);
        }
        lastMarker.bindPopup('Ausgewählter Punkt').openPopup();

        const lat = e.latlng.lat, lon = e.latlng.lng;
        try{
            const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lon}`;
            const res = await fetch(url);
            if(!res.ok) throw new Error('Fehler beim Geocoding');
            const data = await res.json();
            const country = data && data.address && (data.address.country || data.address.country_code);
            if(country){
                currentCountry = country;
                setFeedback('Klicke den Namen und gib ihn ein.', true);
            } else {
                setFeedback('Kein Land gefunden, bitte einen anderen Punkt klicken.', false);
            }
        }catch(err){
            setFeedback('Fehler beim Bestimmen des Landes.', false);
            console.error(err);
        }
    }

    checkBtn.addEventListener('click', ()=>{
        const user = input.value || '';
        if(!currentCountry){ setFeedback('Bitte zuerst auf die Karte klicken.', false); return; }
        const a = normalizeText(user);
        const b = normalizeText(currentCountry);
        if(a === b || (b && b.includes(a) && a.length>2)){
            correct++;
            correctEl.textContent = correct;
            setFeedback('Richtig! ✅ ' + currentCountry, true);
            if(lastMarker) lastMarker.bindPopup('Richtig: ' + currentCountry).openPopup();
        } else {
            wrong++;
            wrongEl.textContent = wrong;
            setFeedback('Falsch ❌ — richtig: ' + currentCountry, false);
            if(lastMarker) lastMarker.bindPopup('Richtig: ' + currentCountry).openPopup();
        }
        // after answer, clear current country so user must click again
        currentCountry = null;
    });

    skipBtn.addEventListener('click', ()=>{
        if(currentCountry){
            wrong++;
            wrongEl.textContent = wrong;
            setFeedback('Übersprungen — richtig: ' + currentCountry, false);
            currentCountry = null;
        } else setFeedback('Kein aktives Land zum Überspringen.', false);
    });

    // listen for Enter in input
    input.addEventListener('keydown', (ev)=>{
        if(ev.key === 'Enter'){
            ev.preventDefault();
            checkBtn.click();
        }
    });

    map.on('click', onMapClick);

    // initial hint
    setFeedback('Klicke irgendwo auf die Karte, um zu starten.', true);
    showHUD();
})();
