import React from 'react';
import MapPage from '../Map';

/* Renders the full Map page inside the scientist layout */
const ScientistPredictions = () => (
  <div style={{ margin: '-2rem', height: 'calc(100vh - 0px)', overflow: 'hidden' }}>
    <MapPage />
  </div>
);

export default ScientistPredictions;
