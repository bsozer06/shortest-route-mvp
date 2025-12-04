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

  const selectingRef = useRef(selecting);

  useEffect(() => {
    selectingRef.current = selecting;
  }, [selecting]);

  const startMarkerRef = useRef(null);
  const endMarkerRef = useRef(null);

  useEffect(() => {
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

      map.on('click', function (e) {
        const currentSelecting = selectingRef.current;

        if (currentSelecting === 'start') {
          clearShortestPath();
          setStart(e.latlng);
          setSelecting(null);
        } else if (currentSelecting === 'end') {
          clearShortestPath();
          setEnd(e.latlng);
          setSelecting(null);
        }
      });
    }
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
      }).addTo(map).bindTooltip('Start', { permanent: true, direction: 'top' }).openTooltip();
    }
    if (end) {
      endMarkerRef.current = L.circleMarker([end.lat, end.lng], {
        radius: 10,
        color: 'red',
        fillColor: 'red',
        fillOpacity: 0.8,
      }).addTo(map).bindTooltip('End', { permanent: true, direction: 'top' }).openTooltip();
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
        });

        const data = await res.json();
        // alert(data.message);

        const map = mapRef.current;
        if (map) {
          // Find the shortestPath layer among WMS layers on the map
          map.eachLayer(layer => {
            console.log('layer:', layer.options.layers);
            if (layer instanceof L.TileLayer.WMS && layer.options.layers === PATH_LAYER) {
              // Add a parameter to force reload of the WMS layer
              layer.setParams({ _: Date.now() });
            }
          });
        }
        if (!res.ok) throw new Error('Network response was not ok');

        // alert('Route sent! WMS layer should refresh on map move/zoom.');

      } catch (err) {
        alert('Error sending route: ' + err.message);
      }
    }
  };

  // Function to clear shortest path data
  const clearShortestPath = async () => {
    try {
      const res = await fetch('http://localhost:3001/clear-shortest-path', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const data = await res.json();
      // alert(data.message || 'Shortest path cleared');
      // Optionally force WMS layer reload
      const map = mapRef.current;
      if (map) {
        map.eachLayer(layer => {
          if (layer instanceof L.TileLayer.WMS && layer.options.layers === PATH_LAYER) {
            layer.setParams({ _: Date.now() });
          }
        });
      }
    } catch (err) {
      alert('Error clearing shortest path: ' + err.message);
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
          Send (Route Request)
        </button>
        <button onClick={clearShortestPath} style={{ marginLeft: '10px', background: '#dc3545', color: 'white' }}>
          Clear Shortest Path
        </button>
        <span style={{ marginLeft: '20px' }}>
          {start && `Start: ${start.lat.toFixed(5)}, ${start.lng.toFixed(5)}`}
          {end && ` | End: ${end.lat.toFixed(5)}, ${end.lng.toFixed(5)}`}
        </span>
      </div>
      <div id="map" style={{ height: '500px', width: '100%' }}></div>
      <div>
        <p>
          Click the relevant button to select start and end points from the map. Selected points are shown on the map with different colored markers and labels. You can send them to the server with the "Send" button. <b>To exit selection mode, click anywhere on the map.</b>
        </p>
      </div>
    </div>
  );
}

export default FrontendMap;