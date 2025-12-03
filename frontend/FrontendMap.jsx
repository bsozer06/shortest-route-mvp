import React, { useRef, useEffect, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

const GEOSERVER_URL = "http://localhost:8080/geoserver/network/wms?";
const GRID_LAYER = "network:grid_lines";
const PATH_LAYER = "network:mv_short_path";

function FrontendMap() {
  const mapRef = useRef(null);
  const [start, setStart] = useState(null);
  const [end, setEnd] = useState(null);
  const [selecting, setSelecting] = useState(null); // 'start' or 'end' or null

  // **DÜZELTME 1: selecting durumunun güncel değerini tutmak için Ref**
  const selectingRef = useRef(selecting);
  
  // Ref'i her `selecting` state değişikliğinde güncelleyin
  useEffect(() => {
    selectingRef.current = selecting;
  }, [selecting]);

  // Marker refs
  const startMarkerRef = useRef(null);
  const endMarkerRef = useRef(null);

  // **DÜZELTME 2: Harita başlatma ve olay dinleyici kurulumu**
  useEffect(() => {
    // Haritayı yalnızca bir kez başlat
    if (!mapRef.current) {
      const map = L.map('map').setView([39.954748, 32.7347912], 10);
      mapRef.current = map;

      // Basemap: OpenStreetMap
      const osm = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; OpenStreetMap contributors',
      });

      // WMS Layers
      const roadNetwork = L.tileLayer.wms(GEOSERVER_URL, {
        layers: GRID_LAYER,
        format: 'image/png',
        transparent: true,
      });
      const shortestPath = L.tileLayer.wms(GEOSERVER_URL, {
        layers: PATH_LAYER,
        format: 'image/png',
        transparent: true,
      });

      // Layer control
      const baseLayers = {
        'OpenStreetMap': osm,
      };
      const overlays = {
        'Road Network': roadNetwork,
        'Shortest Path': shortestPath,
      };
      L.control.layers(baseLayers, overlays).addTo(map);

      osm.addTo(map);
      roadNetwork.addTo(map);
      // Shortest Path layer'ı varsayılan olarak ekli kalsın

      // Tıklama olay dinleyicisi
      map.on('click', function (e) {
        // Güncel `selecting` değerine Ref üzerinden erişin
        const currentSelecting = selectingRef.current; 

        if (currentSelecting === 'start') {
          setStart(e.latlng);
          setSelecting(null);
        } else if (currentSelecting === 'end') {
          setEnd(e.latlng);
          setSelecting(null);
        }
      });
    }

    // Bu useEffect sadece harita başlatma ve olay ekleme işini yapar.
    // Bağımlılık listesini boş bırakarak sadece bileşen mount olduğunda çalışmasını sağlarız.
  }, []); 

  // Show start/end markers as colored circles with labels
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    
    // Remove previous markers
    if (startMarkerRef.current) {
      map.removeLayer(startMarkerRef.current);
      startMarkerRef.current = null;
    }
    if (endMarkerRef.current) {
      map.removeLayer(endMarkerRef.current);
      endMarkerRef.current = null;
    }
    
    // Add new markers as circleMarker
    if (start) {
      startMarkerRef.current = L.circleMarker([start.lat, start.lng], {
        radius: 10,
        color: 'green',
        fillColor: 'green',
        fillOpacity: 0.8,
      }).addTo(map).bindTooltip('Start', {permanent: true, direction: 'top'}).openTooltip();
    }
    if (end) {
      endMarkerRef.current = L.circleMarker([end.lat, end.lng], {
        radius: 10,
        color: 'red',
        fillColor: 'red',
        fillOpacity: 0.8,
      }).addTo(map).bindTooltip('End', {permanent: true, direction: 'top'}).openTooltip();
    }
  }, [start, end]);

  // Manual request function
  const sendRouteRequest = async () => {
    if (start && end) {
      try {
        const res = await fetch('http://localhost:3001/update-route', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ start, end }),
        })
        .then(res => res.json())
        .then(data => {
            alert(data.message);
              shortestPath.setParams({ _: Date.now() }); // refresh wms
          });
        // Shortest Path WMS katmanını yeniden yüklemeye zorlamak için bir yol
        // Bu genellikle WMS katmanının 'setParams' veya 'redraw' çağrılmasıyla yapılır.
        // Ancak kodunuzda shortestPath katmanına erişiminiz olmadığı için,
        // basitleştirilmiş haliyle sadece alert gösteriliyor.
        // Gerçek uygulamada, sunucudan dönen yanıtla WMS katmanı güncellenmelidir.
        if (!res.ok) throw new Error('Network response was not ok');
        // Geoserver'a WMS katmanını güncellemesi için bir komut göndermelisiniz,
        // ancak bu, genellikle Geoserver'ın `shortestPath` katmanını 
        // Start ve End noktalarına göre otomatik olarak filtrelemesi beklenir.
        
        alert('Route sent! WMS layer should refresh on map move/zoom.');
        
      } catch (err) {
        alert('Error sending route: ' + err.message);
      }
    }
  };

  return (
    <div>
      <div style={{ marginBottom: '10px' }}>
        <button onClick={() => setSelecting('start')} disabled={selecting === 'start'}>
          {selecting === 'start' ? 'Select Start (Active)' : 'Select Start'}
        </button>
        <button onClick={() => setSelecting('end')} disabled={selecting === 'end'} style={{ marginLeft: '10px' }}>
          {selecting === 'end' ? 'Select End (Active)' : 'Select End'}
        </button>
        <button onClick={sendRouteRequest} disabled={!(start && end)} style={{ marginLeft: '10px', background: '#007bff', color: 'white' }}>
          Gönder (Route Request)
        </button>
        <span style={{ marginLeft: '20px' }}>
          {start && `Start: ${start.lat.toFixed(5)}, ${start.lng.toFixed(5)}`}
          {end && ` | End: ${end.lat.toFixed(5)}, ${end.lng.toFixed(5)}`}
        </span>
      </div>
      <div id="map" style={{ height: '500px', width: '100%' }}></div>
      <div>
        <p>Haritadan başla ve bitiş noktalarını seçmek için ilgili butona tıklayın. Seçilen noktalar haritada farklı renkli marker ve etiketle gösterilir. "Gönder" butonu ile sunucuya iletebilirsiniz. **Seçim modundan çıkmak için haritada bir noktaya tıklayın.**</p>
      </div>
    </div>
  );
}

export default FrontendMap;