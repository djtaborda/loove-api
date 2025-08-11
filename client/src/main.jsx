import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router-dom';
import router from './router.jsx';
import './styles.css';
if ('serviceWorker' in navigator) {
navigator.serviceWorker.register('/service-worker.js');
}
createRoot(document.getElementById('root')).render(<RouterProvider
router={router} />);
