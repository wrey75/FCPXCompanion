import * as React from 'react';
// import * as ReactDOM from 'react-dom';
import { createRoot } from 'react-dom/client';
import { refresh } from './fcpx-scanner.js';
import App from './fcpx-react.jsx';

const container = document.getElementById('app');
const root = createRoot(container); // createRoot(container!) if you use TypeScript
root.render(<App />);

setInterval(() => {
    const props = refresh(); // <-- Using the old method with manual rendering
    root.render(<App status={props}/>);
}, 500);

import './fcpx-gui.js';
import './fcpx-renderer.js';
