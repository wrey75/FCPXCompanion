import * as React from 'react';
// import * as ReactDOM from 'react-dom';
import { createRoot } from 'react-dom/client';
import App from './fcpx-react.jsx';

const container = document.getElementById('app');
const root = createRoot(container); // createRoot(container!) if you use TypeScript
root.render(<App />);

import './fcpx-gui.js';
import './fcpx-scanner.js';
import './fcpx-renderer.js';


