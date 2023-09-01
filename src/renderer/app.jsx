import * as React from 'react';
// import * as ReactDOM from 'react-dom';
import { createRoot } from 'react-dom/client';
import { refresh } from './fcpx-scanner.js';
import App from './fcpx-react.jsx';

// Import our custom CSS
import './App.scss'

// Import all of Bootstrap's JS
import './index.css';

const container = document.getElementById('app');
const root = createRoot(container); // createRoot(container!) if you use TypeScript

setInterval(() => {
    const props = refresh(); // <-- Using the old method with manual rendering
    root.render(<App status={props} />);
}, 500);

import './fcpx-renderer.js';
