import { attachToWindow, install } from './contentScript';

// Attach bundle API and install message listeners immediately.
attachToWindow();
install();

