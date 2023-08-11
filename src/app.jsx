import * as React from 'react';
// import * as ReactDOM from 'react-dom';
import { createRoot } from 'react-dom/client';

const container = document.getElementById('app');
const root = createRoot(container); // createRoot(container!) if you use TypeScript
root.render(<p><small>Hello from React!</small></p>);

import './fcpx-gui.js';
import './fcpx-scanner.js';
import './fcpx-renderer.js';


